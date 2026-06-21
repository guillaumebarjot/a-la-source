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
    'SELECT id, parcours_id, score FROM parcours_sessions WHERE id = ?'
  ).get(req.params.sid) as { id: number; parcours_id: number; score: number } | undefined
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
  const traiter = db.transaction(() => {
    const r = db.prepare(`
      INSERT OR IGNORE INTO parcours_reponses (session_id, question_id, mecanisme_choisi_id, correct)
      VALUES (?, ?, ?, ?)
    `).run(session.id, question.id, mecanisme_choisi_id, correct)
    if (r.changes > 0 && correct === 1) {
      db.prepare('UPDATE parcours_sessions SET score = score + 1 WHERE id = ?').run(session.id)
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
