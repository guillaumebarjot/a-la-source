import { Router } from 'express'
import db from '../lib/db.js'
import { requireRole } from '../lib/auth.js'

const router = Router()

// --- Multi-quiz par theme (chantier #1) ---
// Un parcours est un quiz. Il peut etre rattache a un grand theme (sujet_id) et
// vivre en deux modes :
//   - 'curate' : questions figees, choisies par l'animateur (comportement historique).
//   - 'tirage' : questions instanciees au demarrage de la 1re session, piochees dans
//                la banque (source_mecanismes) selon une regle (parcours.regle_tirage).
// La banque est une VUE logique : chaque ligne source_mecanismes (source + mecanisme
// attendu) est une question potentielle. Aucune table lourde n'est ajoutee.

type RegleTirage = {
  n?: number                 // nombre de questions a tirer (defaut 10)
  categories?: string[]      // categories de mecanismes a retenir (optionnel)
  exclure_source_ids?: number[]
}

function parseRegle(raw: unknown): RegleTirage {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as RegleTirage
  try { return JSON.parse(String(raw)) as RegleTirage } catch { return {} }
}

// --- Repetition espacee (patron Anki / SM-2, recadre auto-apprentissage) ---
// La carte a reviser est un MECANISME (pas une question d'examen). On upsert une
// ligne (utilisateur_id, mecanisme_id) a chaque cl, et on ajuste l'intervalle et la
// facilite facon SM-2. Doctrine epoche : pas de note, pas de fail, pas de streak. Le
// succes allonge l'intervalle (1 -> 6 -> round(intervalle * facilite)), l'echec le
// raccourcit doucement (retour a 1 jour, facilite vers le bas, plancher 1.3). Jamais
// de valeur negative ni d'affichage de fail : c'est une planification, pas un verdict.
const FACILITE_DEPART = 2.5
const FACILITE_PLANCHER = 1.3

function upsertRevision(utilisateurId: number, mecanismeId: number, reconnu: boolean): void {
  const existant = db.prepare(
    'SELECT intervalle_jours, facilite, nb_revus FROM revisions_mecanismes WHERE utilisateur_id = ? AND mecanisme_id = ?'
  ).get(utilisateurId, mecanismeId) as
    { intervalle_jours: number; facilite: number; nb_revus: number } | undefined

  let intervalle: number
  let facilite: number
  let nbRevus: number

  if (!existant) {
    // Premiere rencontre : on programme un premier rappel court (succes) ou immediat (a revoir).
    nbRevus = reconnu ? 1 : 0
    intervalle = reconnu ? 1 : 1
    facilite = FACILITE_DEPART
  } else {
    facilite = existant.facilite
    if (reconnu) {
      // Ajustement doux de la facilite vers le haut (cap a 3.0 pour rester sobre).
      facilite = Math.min(3.0, facilite + 0.1)
      nbRevus = existant.nb_revus + 1
      // Paliers SM-2 : 1er rappel 1 j, 2e 6 j, puis croissance geometrique.
      if (existant.nb_revus <= 0) intervalle = 1
      else if (existant.nb_revus === 1) intervalle = 6
      else intervalle = Math.max(1, Math.round(existant.intervalle_jours * facilite))
    } else {
      // « A revoir » : raccourcissement doux (jamais affiche comme un echec).
      facilite = Math.max(FACILITE_PLANCHER, facilite - 0.2)
      nbRevus = existant.nb_revus // on ne touche pas le compteur de passages reussis
      intervalle = 1
    }
  }

  db.prepare(`
    INSERT INTO revisions_mecanismes
      (utilisateur_id, mecanisme_id, intervalle_jours, facilite, nb_revus, prochaine_revision, maj_le)
    VALUES (?, ?, ?, ?, ?, date('now', '+' || ? || ' days'), CURRENT_TIMESTAMP)
    ON CONFLICT(utilisateur_id, mecanisme_id) DO UPDATE SET
      intervalle_jours   = excluded.intervalle_jours,
      facilite           = excluded.facilite,
      nb_revus           = excluded.nb_revus,
      prochaine_revision = excluded.prochaine_revision,
      maj_le             = CURRENT_TIMESTAMP
  `).run(utilisateurId, mecanismeId, intervalle, facilite, nbRevus, intervalle)
}

// GET /api/parcours — liste des parcours, avec sujet et nb de questions.
// On expose sujet_id / sujet_titre / sujet_slug pour le regroupement par theme,
// ainsi que mode (curate / tirage). Pour un quiz a tirage non encore instancie,
// nb_questions reflete la regle (n) plutot que 0, pour que la carte annonce
// honnetement « ~N questions ».
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.titre, p.description, p.cree_le,
           p.sujet_id, p.mode, p.regle_tirage,
           su.titre AS sujet_titre, su.slug AS sujet_slug,
           COUNT(q.id) AS nb_questions
    FROM parcours p
    LEFT JOIN parcours_questions q ON q.parcours_id = p.id
    LEFT JOIN sujets su ON su.id = p.sujet_id
    GROUP BY p.id
    ORDER BY su.titre IS NULL, su.titre ASC, p.cree_le ASC
  `).all() as Array<{
    id: number; titre: string; description: string | null; cree_le: string
    sujet_id: number | null; mode: string; regle_tirage: string | null
    sujet_titre: string | null; sujet_slug: string | null; nb_questions: number
  }>

  const liste = rows.map((r) => {
    let nb = r.nb_questions
    if (r.mode === 'tirage' && nb === 0) {
      const regle = parseRegle(r.regle_tirage)
      nb = regle.n && regle.n > 0 ? regle.n : 10
    }
    const { regle_tirage: _omis, ...reste } = r
    return { ...reste, nb_questions: nb }
  })
  res.json(liste)
})

// POST /api/parcours — creer un parcours (animateur / admin).
// Additif : accepte sujet_id (rattachement au theme), mode ('curate' | 'tirage')
// et regle_tirage (objet JSON). En mode curate, les questions sont posees ici.
// En mode tirage, on ne pose rien : la 1re session instancie les questions.
router.post('/', requireRole('animateur', 'admin'), (req, res) => {
  const { titre, description, sujet_id, mode, regle_tirage, questions } = req.body as {
    titre?: string
    description?: string
    sujet_id?: number | null
    mode?: string
    regle_tirage?: RegleTirage | null
    questions?: { source_id: number; mecanisme_attendu_id: number; explication?: string }[]
  }
  if (!titre || !titre.trim()) { res.status(400).json({ error: 'titre requis' }); return }
  const modeFinal = mode === 'tirage' ? 'tirage' : 'curate'
  const regleJson = modeFinal === 'tirage' && regle_tirage
    ? JSON.stringify(regle_tirage)
    : null

  const insP = db.prepare(
    'INSERT INTO parcours (titre, description, cree_par, sujet_id, mode, regle_tirage) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insQ = db.prepare(`
    INSERT INTO parcours_questions (parcours_id, ordre, source_id, mecanisme_attendu_id, explication)
    VALUES (?, ?, ?, ?, ?)
  `)
  const creer = db.transaction(() => {
    const pid = Number(insP.run(
      titre.trim(), description || null, req.user?.id ?? null,
      sujet_id || null, modeFinal, regleJson
    ).lastInsertRowid)
    if (modeFinal === 'curate' && Array.isArray(questions)) {
      questions.forEach((q, i) => {
        if (q && q.source_id && q.mecanisme_attendu_id) {
          insQ.run(pid, i + 1, q.source_id, q.mecanisme_attendu_id, q.explication || null)
        }
      })
    }
    return pid
  })
  const id = creer()
  res.status(201).json({ id })
})

// ===========================================================================
// Back-office de creation de quiz (animateur / admin)
// ===========================================================================

// Construit le SQL des « sources jouables » : sources exploitables comme questions,
// c.-a-d. ayant AU MOINS un mecanisme identifie (source_mecanismes non vide). On
// retient une ligne par source (le mecanisme le plus anciennement pose comme
// mecanisme attendu de reference), avec un drapeau image presente. Filtres optionnels :
// par sujet (via sujet_sources). Tri : image d'abord (jouabilite), puis recence.
function sourcesJouablesSql(filtreSujet: boolean): string {
  const where = filtreSujet
    ? 'WHERE sm.source_id IN (SELECT source_id FROM sujet_sources WHERE sujet_id = ?)'
    : ''
  return `
    SELECT s.id AS source_id, s.titre AS source_titre,
           s.accroche AS source_accroche, s.image_url AS source_image_url,
           s.url AS source_url, m.nom AS source_media_nom,
           (s.image_url IS NOT NULL AND s.image_url != '') AS a_image,
           COUNT(DISTINCT sm.mecanisme_id) AS nb_mecanismes,
           fr.mecanisme_id AS mecanisme_attendu_id,
           mr.nom AS mecanisme_nom, mr.categorie AS mecanisme_categorie
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    -- premier mecanisme pose sur la source = mecanisme attendu de reference
    JOIN (
      SELECT source_id, mecanisme_id
      FROM source_mecanismes sm2
      WHERE sm2.id = (
        SELECT sm3.id FROM source_mecanismes sm3
        WHERE sm3.source_id = sm2.source_id
        ORDER BY sm3.identifie_le ASC, sm3.id ASC LIMIT 1
      )
    ) fr ON fr.source_id = s.id
    JOIN mecanismes_reference mr ON mr.id = fr.mecanisme_id
    ${where}
    GROUP BY s.id
    ORDER BY a_image DESC, s.soumis_le DESC, s.id DESC
  `
}

// GET /api/parcours/sources-jouables?sujet=ID
// Liste les sources exploitables comme questions (source_mecanismes non vide), avec
// leur mecanisme attendu de reference et un drapeau image. Outille le back-office.
// IMPORTANT : route a UN segment, declaree AVANT GET /:id pour ne pas etre captee.
router.get('/sources-jouables', requireRole('animateur', 'admin'), (req, res) => {
  const sujetId = req.query.sujet ? Number(req.query.sujet) : null
  const sql = sourcesJouablesSql(sujetId != null && Number.isFinite(sujetId))
  const rows = sujetId != null && Number.isFinite(sujetId)
    ? db.prepare(sql).all(sujetId)
    : db.prepare(sql).all()
  res.json(rows)
})

// POST /api/parcours/from-sujet — cree un quiz curate adosse a un sujet, a partir
// d'une selection de sources jouables. Corps : { sujet_id, titre?, description?,
// niveau?, source_ids?[] }. Si source_ids est omis, on prend toutes les sources
// jouables du sujet (limite a 15). Chaque source devient une question avec son
// mecanisme attendu de reference et la justification reelle comme explication.
router.post('/from-sujet', requireRole('animateur', 'admin'), (req, res) => {
  const { sujet_id, titre, description, source_ids } = req.body as {
    sujet_id?: number; titre?: string; description?: string; source_ids?: number[]
  }
  if (!sujet_id) { res.status(400).json({ error: 'sujet_id requis' }); return }
  const sujet = db.prepare('SELECT id, titre FROM sujets WHERE id = ?').get(sujet_id) as
    { id: number; titre: string } | undefined
  if (!sujet) { res.status(404).json({ error: 'Sujet introuvable' }); return }

  // Banque jouable du sujet (source -> mecanisme attendu + justification).
  const jouables = db.prepare(`
    SELECT s.id AS source_id, fr.mecanisme_id AS mecanisme_attendu_id,
           (SELECT MAX(justification) FROM source_mecanismes WHERE source_id = s.id AND mecanisme_id = fr.mecanisme_id) AS justification,
           (SELECT MAX(extrait) FROM source_mecanismes WHERE source_id = s.id AND mecanisme_id = fr.mecanisme_id) AS extrait
    FROM sources s
    JOIN (
      SELECT source_id, mecanisme_id FROM source_mecanismes sm2
      WHERE sm2.id = (SELECT sm3.id FROM source_mecanismes sm3 WHERE sm3.source_id = sm2.source_id ORDER BY sm3.identifie_le ASC, sm3.id ASC LIMIT 1)
    ) fr ON fr.source_id = s.id
    WHERE s.id IN (SELECT source_id FROM sujet_sources WHERE sujet_id = ?)
    ORDER BY (s.image_url IS NOT NULL AND s.image_url != '') DESC, s.soumis_le DESC
  `).all(sujet_id) as { source_id: number; mecanisme_attendu_id: number; justification: string | null; extrait: string | null }[]

  const choisies = Array.isArray(source_ids) && source_ids.length > 0
    ? jouables.filter((j) => source_ids.includes(j.source_id))
    : jouables.slice(0, 15)
  if (choisies.length === 0) { res.status(422).json({ error: 'Aucune source jouable pour ce sujet/cette selection' }); return }

  const pid = creerQuizCurate(
    titre?.trim() || `Tester son oeil : ${sujet.titre}`,
    description || null, sujet_id, req.user?.id ?? null, choisies
  )
  res.status(201).json({ id: pid, nb_questions: choisies.length })
})

// POST /api/parcours/from-dossier — cree un quiz curate a partir du corpus d'un
// dossier (activite de type 'dossier'). Corps : { activite_id, titre?, description? }.
// On prend les sources du dossier (activite_sources) qui sont jouables (mecanisme pose),
// et on en fait un quiz adosse au sujet du dossier. Geste « creer un quiz a partir de ce dossier ».
router.post('/from-dossier', requireRole('animateur', 'admin'), (req, res) => {
  const { activite_id, titre, description } = req.body as {
    activite_id?: number; titre?: string; description?: string
  }
  if (!activite_id) { res.status(400).json({ error: 'activite_id requis' }); return }
  const dossier = db.prepare(
    "SELECT id, titre, sujet_id FROM activites WHERE id = ? AND type = 'dossier'"
  ).get(activite_id) as { id: number; titre: string; sujet_id: number | null } | undefined
  if (!dossier) { res.status(404).json({ error: 'Dossier introuvable' }); return }

  const jouables = db.prepare(`
    SELECT s.id AS source_id, fr.mecanisme_id AS mecanisme_attendu_id,
           (SELECT MAX(justification) FROM source_mecanismes WHERE source_id = s.id AND mecanisme_id = fr.mecanisme_id) AS justification,
           (SELECT MAX(extrait) FROM source_mecanismes WHERE source_id = s.id AND mecanisme_id = fr.mecanisme_id) AS extrait,
           asrc.ordre AS ordre
    FROM activite_sources asrc
    JOIN sources s ON s.id = asrc.source_id
    JOIN (
      SELECT source_id, mecanisme_id FROM source_mecanismes sm2
      WHERE sm2.id = (SELECT sm3.id FROM source_mecanismes sm3 WHERE sm3.source_id = sm2.source_id ORDER BY sm3.identifie_le ASC, sm3.id ASC LIMIT 1)
    ) fr ON fr.source_id = s.id
    WHERE asrc.activite_id = ?
    ORDER BY asrc.ordre ASC, s.id ASC
  `).all(activite_id) as { source_id: number; mecanisme_attendu_id: number; justification: string | null; extrait: string | null }[]

  if (jouables.length === 0) { res.status(422).json({ error: 'Aucune source jouable dans ce dossier' }); return }

  const pid = creerQuizCurate(
    titre?.trim() || `Tester son oeil : ${dossier.titre}`,
    description || null, dossier.sujet_id, req.user?.id ?? null, jouables
  )
  res.status(201).json({ id: pid, nb_questions: jouables.length, sujet_id: dossier.sujet_id })
})

// Helper commun : cree un parcours curate + ses questions a partir de couples
// (source_id, mecanisme_attendu_id, justification/extrait). Renvoie l'id du parcours.
function creerQuizCurate(
  titre: string, description: string | null, sujetId: number | null,
  creePar: number | null,
  questions: { source_id: number; mecanisme_attendu_id: number; justification: string | null; extrait: string | null }[]
): number {
  const insP = db.prepare(
    "INSERT INTO parcours (titre, description, cree_par, sujet_id, mode, regle_tirage) VALUES (?, ?, ?, ?, 'curate', NULL)"
  )
  const insQ = db.prepare(`
    INSERT INTO parcours_questions (parcours_id, ordre, source_id, mecanisme_attendu_id, explication)
    VALUES (?, ?, ?, ?, ?)
  `)
  const creer = db.transaction(() => {
    const pid = Number(insP.run(titre, description, creePar, sujetId).lastInsertRowid)
    questions.forEach((q, i) => {
      const explication = q.justification && q.justification.trim().length > 0
        ? q.justification
        : (q.extrait || null)
      insQ.run(pid, i + 1, q.source_id, q.mecanisme_attendu_id, explication)
    })
    return pid
  })
  return creer()
}

// ===========================================================================
// Repetition espacee — endpoints (auto-apprentissage, jamais de note ni de fail)
// ===========================================================================

// GET /api/parcours/revisions/a-revoir — mecanismes dont prochaine_revision <= aujourd'hui
// pour l'utilisateur courant. Encart doux « A reancrer aujourd'hui » : une invitation,
// pas une dette. Route a deux segments : aucune collision avec GET /:id.
router.get('/revisions/a-revoir', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'auth requise' }); return }
  const rows = db.prepare(`
    SELECT rm.mecanisme_id, mr.nom AS mecanisme_nom, mr.categorie AS mecanisme_categorie,
           rm.intervalle_jours, rm.nb_revus, rm.prochaine_revision
    FROM revisions_mecanismes rm
    JOIN mecanismes_reference mr ON mr.id = rm.mecanisme_id
    WHERE rm.utilisateur_id = ? AND rm.prochaine_revision <= date('now')
    ORDER BY rm.prochaine_revision ASC, rm.intervalle_jours ASC
  `).all(req.user.id)
  res.json(rows)
})

// POST /api/parcours/revisions/quiz — instancie un mini-quiz « a reancrer » tire de la
// banque (source_mecanismes) sur les mecanismes dus de l'utilisateur. Corps optionnel :
// { mecanisme_ids?[], n? }. Si mecanisme_ids omis, on prend les mecanismes dus. Cree un
// parcours curate ephemere (sujet_id NULL, mode curate) et renvoie son id : le front le
// joue comme un parcours normal (memes endpoints session/reponses). Une NOUVELLE source
// peut servir le meme mecanisme (la grille de lecture, pas la source, est l'objet revise).
router.post('/revisions/quiz', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'auth requise' }); return }
  const { mecanisme_ids, n } = req.body as { mecanisme_ids?: number[]; n?: number }

  let mecaIds: number[]
  if (Array.isArray(mecanisme_ids) && mecanisme_ids.length > 0) {
    mecaIds = mecanisme_ids.filter((x) => Number.isFinite(x))
  } else {
    mecaIds = (db.prepare(`
      SELECT mecanisme_id FROM revisions_mecanismes
      WHERE utilisateur_id = ? AND prochaine_revision <= date('now')
      ORDER BY prochaine_revision ASC
    `).all(req.user.id) as { mecanisme_id: number }[]).map((r) => r.mecanisme_id)
  }
  if (mecaIds.length === 0) { res.status(422).json({ error: 'Aucun mecanisme a reancrer' }); return }

  const limite = n && n > 0 ? Math.min(n, 20) : Math.min(mecaIds.length, 10)
  // Une question par mecanisme du : on tire UNE source au hasard mobilisant ce mecanisme.
  const placeholders = mecaIds.map(() => '?').join(',')
  const lignes = db.prepare(`
    SELECT t.mecanisme_id, t.source_id,
           (SELECT MAX(justification) FROM source_mecanismes WHERE source_id = t.source_id AND mecanisme_id = t.mecanisme_id) AS justification,
           (SELECT MAX(extrait) FROM source_mecanismes WHERE source_id = t.source_id AND mecanisme_id = t.mecanisme_id) AS extrait
    FROM (
      SELECT sm.mecanisme_id, sm.source_id,
             ROW_NUMBER() OVER (PARTITION BY sm.mecanisme_id ORDER BY RANDOM()) AS rn
      FROM source_mecanismes sm
      WHERE sm.mecanisme_id IN (${placeholders})
    ) t
    WHERE t.rn = 1
    ORDER BY RANDOM()
    LIMIT ?
  `).all(...mecaIds, limite) as
    { mecanisme_id: number; source_id: number; justification: string | null; extrait: string | null }[]

  if (lignes.length === 0) { res.status(422).json({ error: 'Aucune source jouable pour ces mecanismes' }); return }

  const pid = creerQuizCurate(
    'A reancrer', 'Mini-quiz de revision espacee, tire de la banque sur tes mecanismes du jour.',
    null, req.user.id,
    lignes.map((l) => ({ source_id: l.source_id, mecanisme_attendu_id: l.mecanisme_id, justification: l.justification, extrait: l.extrait }))
  )
  res.status(201).json({ id: pid, nb_questions: lignes.length, mecanisme_ids: mecaIds })
})

// Instancie les questions d'un quiz a tirage si elles ne le sont pas encore.
// On pioche dans la banque (source_mecanismes) : une source distincte par question,
// avec son mecanisme attendu et la justification reelle comme explication. La regle
// peut restreindre au sujet du parcours, aux categories de mecanismes et a un nombre.
// Idempotent : ne fait rien si des questions existent deja (le tirage est fige a la
// 1re session ; un re-tirage par session est une suite, hors scope ici).
function instancierTirageSiBesoin(parcours: {
  id: number; sujet_id: number | null; mode: string; regle_tirage: string | null
}): void {
  if (parcours.mode !== 'tirage') return
  const nbExistantes = (db.prepare(
    'SELECT COUNT(*) AS c FROM parcours_questions WHERE parcours_id = ?'
  ).get(parcours.id) as { c: number }).c
  if (nbExistantes > 0) return

  const regle = parseRegle(parcours.regle_tirage)
  const n = regle.n && regle.n > 0 ? Math.min(regle.n, 30) : 10

  // Filtres optionnels : sujet du parcours (via sujet_sources), categories de
  // mecanismes, exclusions de sources. RANDOM() pour renouveler l'exploration.
  const where: string[] = []
  const params: unknown[] = []
  if (parcours.sujet_id) {
    where.push('sm.source_id IN (SELECT source_id FROM sujet_sources WHERE sujet_id = ?)')
    params.push(parcours.sujet_id)
  }
  if (Array.isArray(regle.categories) && regle.categories.length > 0) {
    where.push(`mr.categorie IN (${regle.categories.map(() => '?').join(',')})`)
    params.push(...regle.categories)
  }
  if (Array.isArray(regle.exclure_source_ids) && regle.exclure_source_ids.length > 0) {
    where.push(`sm.source_id NOT IN (${regle.exclure_source_ids.map(() => '?').join(',')})`)
    params.push(...regle.exclure_source_ids)
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const lignes = db.prepare(`
    SELECT sm.source_id, sm.mecanisme_id,
           MAX(sm.justification) AS justification, MAX(sm.extrait) AS extrait
    FROM source_mecanismes sm
    JOIN sources s ON s.id = sm.source_id
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    ${clause}
    GROUP BY sm.source_id
    ORDER BY RANDOM()
    LIMIT ?
  `).all(...params, n) as {
    source_id: number; mecanisme_id: number; justification: string | null; extrait: string | null
  }[]

  if (lignes.length === 0) return
  const insQ = db.prepare(`
    INSERT INTO parcours_questions (parcours_id, ordre, source_id, mecanisme_attendu_id, explication)
    VALUES (?, ?, ?, ?, ?)
  `)
  const poser = db.transaction(() => {
    lignes.forEach((l, i) => {
      const explication = l.justification && l.justification.trim().length > 0
        ? l.justification
        : (l.extrait || null)
      insQ.run(parcours.id, i + 1, l.source_id, l.mecanisme_id, explication)
    })
  })
  poser()
}

// GET /api/parcours/:id — parcours + questions pour jouer.
// On NE revele PAS le mecanisme attendu ni l'explication : carte-source nue.
// Pour un quiz a tirage non encore instancie, on materialise d'abord les questions.
router.get('/:id', (req, res) => {
  const parcours = db.prepare(
    'SELECT id, titre, description, sujet_id, mode, regle_tirage FROM parcours WHERE id = ?'
  ).get(req.params.id) as {
    id: number; titre: string; description: string | null
    sujet_id: number | null; mode: string; regle_tirage: string | null
  } | undefined
  if (!parcours) { res.status(404).json({ error: 'Parcours introuvable' }); return }

  instancierTirageSiBesoin(parcours)

  const sujet = parcours.sujet_id
    ? db.prepare('SELECT titre, slug FROM sujets WHERE id = ?').get(parcours.sujet_id) as
        { titre: string; slug: string } | undefined
    : undefined

  // Carte-source NUE : image + titre + chapo + media + url, aucun indice du mecanisme.
  // On expose source_media_nom et source_url (le front les consomme deja en option),
  // pour afficher le media et permettre « lire la source ».
  const questions = db.prepare(`
    SELECT q.id, q.ordre,
           s.id AS source_id, s.titre AS source_titre,
           s.accroche AS source_accroche, s.image_url AS source_image_url,
           s.url AS source_url, m.nom AS source_media_nom
    FROM parcours_questions q
    JOIN sources s ON s.id = q.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE q.parcours_id = ?
    ORDER BY q.ordre ASC, q.id ASC
  `).all(parcours.id)

  // Choix proposes : tous les mecanismes de reference (le bon est noye dedans).
  const mecanismes = db.prepare(
    'SELECT id, nom, categorie FROM mecanismes_reference ORDER BY categorie, nom'
  ).all()

  const { regle_tirage: _omis, ...base } = parcours
  res.json({
    ...base,
    sujet_titre: sujet?.titre ?? null,
    sujet_slug: sujet?.slug ?? null,
    questions,
    mecanismes,
  })
})

// POST /api/parcours/:id/sessions — demarre une session pour l'utilisateur courant
router.post('/:id/sessions', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'auth requise' }); return }
  const parcours = db.prepare(
    'SELECT id, sujet_id, mode, regle_tirage FROM parcours WHERE id = ?'
  ).get(req.params.id) as {
    id: number; sujet_id: number | null; mode: string; regle_tirage: string | null
  } | undefined
  if (!parcours) { res.status(404).json({ error: 'Parcours introuvable' }); return }

  instancierTirageSiBesoin(parcours)

  const total = (db.prepare(
    'SELECT COUNT(*) AS c FROM parcours_questions WHERE parcours_id = ?'
  ).get(parcours.id) as { c: number }).c

  const sid = Number(db.prepare(
    'INSERT INTO parcours_sessions (parcours_id, utilisateur_id, score, total) VALUES (?, ?, 0, ?)'
  ).run(parcours.id, req.user.id, total).lastInsertRowid)

  res.status(201).json({ session_id: sid, total })
})

// POST /api/parcours/sessions/:sid/reponses — enregistre une reponse et corrige
router.post('/sessions/:sid/reponses', (req, res) => {
  const { question_id, mecanisme_choisi_id } = req.body as {
    question_id?: number
    mecanisme_choisi_id?: number
  }
  if (!question_id || !mecanisme_choisi_id) {
    res.status(400).json({ error: 'question_id et mecanisme_choisi_id requis' }); return
  }

  const session = db.prepare(
    'SELECT id, parcours_id, score, utilisateur_id FROM parcours_sessions WHERE id = ?'
  ).get(req.params.sid) as
    { id: number; parcours_id: number; score: number; utilisateur_id: number | null } | undefined
  if (!session) { res.status(404).json({ error: 'Session introuvable' }); return }

  const question = db.prepare(`
    SELECT id, mecanisme_attendu_id, explication
    FROM parcours_questions
    WHERE id = ? AND parcours_id = ?
  `).get(question_id, session.parcours_id) as
    { id: number; mecanisme_attendu_id: number; explication: string | null } | undefined
  if (!question) { res.status(404).json({ error: 'Question introuvable dans ce parcours' }); return }

  const correct = mecanisme_choisi_id === question.mecanisme_attendu_id ? 1 : 0

  const attendu = db.prepare(
    'SELECT id, nom, categorie FROM mecanismes_reference WHERE id = ?'
  ).get(question.mecanisme_attendu_id) as { id: number; nom: string; categorie: string | null } | undefined

  // Insertion idempotente : on ne recompte pas le score si la question a deja ete repondue.
  // A la cloture d'une reponse NEUVE, on upsert la planification de revision espacee du
  // mecanisme attendu (la grille de lecture), facon SM-2. On ne replanifie pas si la
  // question avait deja ete repondue (pas de double comptage).
  const traiter = db.transaction(() => {
    const r = db.prepare(`
      INSERT OR IGNORE INTO parcours_reponses (session_id, question_id, mecanisme_choisi_id, correct)
      VALUES (?, ?, ?, ?)
    `).run(session.id, question.id, mecanisme_choisi_id, correct)
    if (r.changes > 0) {
      if (correct === 1) {
        db.prepare('UPDATE parcours_sessions SET score = score + 1 WHERE id = ?').run(session.id)
      }
      if (session.utilisateur_id != null) {
        upsertRevision(session.utilisateur_id, question.mecanisme_attendu_id, correct === 1)
      }
    }
  })
  traiter()

  // Cloture si toutes les questions ont une reponse.
  const restantes = (db.prepare(`
    SELECT COUNT(*) AS c FROM parcours_questions q
    WHERE q.parcours_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM parcours_reponses r WHERE r.session_id = ? AND r.question_id = q.id
      )
  `).get(session.parcours_id, session.id) as { c: number }).c
  if (restantes === 0) {
    db.prepare("UPDATE parcours_sessions SET termine_le = CURRENT_TIMESTAMP WHERE id = ? AND termine_le IS NULL")
      .run(session.id)
  }

  const etat = db.prepare(
    'SELECT score, total, termine_le FROM parcours_sessions WHERE id = ?'
  ).get(session.id) as { score: number; total: number; termine_le: string | null }

  res.json({
    correct: correct === 1,
    mecanisme_attendu: attendu || null,
    explication: question.explication,
    score: etat.score,
    total: etat.total,
    termine: etat.termine_le != null,
  })
})

// GET /api/parcours/sessions/:sid — etat / score d'une session
router.get('/sessions/:sid', (req, res) => {
  const session = db.prepare(`
    SELECT id, parcours_id, utilisateur_id, score, total, commence_le, termine_le
    FROM parcours_sessions WHERE id = ?
  `).get(req.params.sid)
  if (!session) { res.status(404).json({ error: 'Session introuvable' }); return }
  res.json(session)
})

export default router
