/**
 * Bot Discord bidirectionnel pour A la source
 *
 * Fonctionnalites :
 * - Discord → App : soumission de sources via URL, analyse conversationnelle,
 *   evaluations, commentaires, tags, archivage, upload pieces jointes
 * - App → Discord : notifications (nouvelle source, evaluation, atelier)
 *
 * Configuration requise dans .env ou parametres BDD :
 * - DISCORD_TOKEN : token du bot
 * - DISCORD_CHANNEL_VEILLE : ID du canal de veille
 * - DISCORD_CHANNEL_NOTIFS : ID du canal de notifications
 */

import db from '../lib/db.js'
import { calculerScoreSource } from '../lib/score.js'
import { extractReadability, detecterArchivePartielle, compterMots } from '../lib/readability.js'

// Types pour le bot (sans importer discord.js tant que pas installe)
interface DiscordConfig {
  token: string
  channelVeille: string
  channelNotifs: string
  guildIds: string[]
}

interface ConversationState {
  userId: string
  command: string
  sourceId: number
  step: number
  data: Record<string, unknown>
}

// Conversations actives (en memoire, pas persistees)
const conversations = new Map<string, ConversationState>()

function baseApp(): string {
  return process.env.PUBLIC_BASE_URL || 'https://alasource.barjot.net'
}

/**
 * Recupere la config Discord depuis les parametres ou l'env
 */
export function getDiscordConfig(): DiscordConfig | null {
  // Priorite : env vars
  if (process.env.DISCORD_TOKEN) {
    return {
      token: process.env.DISCORD_TOKEN,
      channelVeille: process.env.DISCORD_CHANNEL_VEILLE || '',
      channelNotifs: process.env.DISCORD_CHANNEL_NOTIFS || '',
      guildIds: (process.env.DISCORD_GUILD_IDS || '').split(',').filter(Boolean)
    }
  }

  // Fallback : parametres BDD
  const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'discord'").get() as { valeur: string } | undefined
  if (!row) return null

  try {
    return JSON.parse(row.valeur) as DiscordConfig
  } catch {
    return null
  }
}

/**
 * Gestion des commandes conversationnelles
 */
export function handleCommand(userId: string, appUserId: number | null, command: string, args: string): {
  response: string
  expectsReply: boolean
} {
  const cmd = command.toLowerCase()

  switch (cmd) {
    case '!source': return cmdSource(appUserId, args)
    case '!fiche': return cmdFiche(args)
    case '!analyser': return cmdAnalyser(userId, appUserId, args)
    case '!evaluer': return cmdEvaluer(userId, appUserId, args)
    case '!commenter': return cmdCommenter(userId, appUserId, args)
    case '!editcom':
    case '!modifcom': return cmdEditCommentaire(appUserId, args)
    case '!taguer': return cmdTaguer(userId, appUserId, args)
    case '!archiver': return cmdArchiverHint(args)
    case '!score': return cmdScore(args)
    case '!vivier': return cmdVivier()
    case '!atelier': return cmdAtelier()
    case '!abandon':
    case '!annuler':
    case '!stop': return cmdAbandon(userId)
    case '!aide':
    case '!manuel':
    case '!guide': return cmdAide()
    default: return { response: '', expectsReply: false }
  }
}

/**
 * Gestion des reponses dans une conversation active
 */
export function handleReply(userId: string, message: string): {
  response: string
  expectsReply: boolean
  done: boolean
} {
  const conv = conversations.get(userId)
  if (!conv) return { response: '', expectsReply: false, done: true }

  switch (conv.command) {
    case 'analyser': return stepAnalyser(conv, message)
    case 'evaluer': return stepEvaluer(conv, message)
    case 'commenter': return stepCommenter(conv, message)
    case 'taguer': return stepTaguer(conv, message)
    default:
      conversations.delete(userId)
      return { response: 'Conversation terminee.', expectsReply: false, done: true }
  }
}

// --- Commandes simples ---

// !source <id> = consulter une source ; coller un lien = ingestion auto (pas de commande).
function cmdSource(_appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const a = (args || '').trim()
  if (/^\d+$/.test(a)) return cmdFiche(a)
  if (a.startsWith('http')) {
    return { response: "Pas besoin de commande : colle simplement le lien dans le salon, je l'ingere et je te reponds. Pour consulter une source : `!source <id>`.", expectsReply: false }
  }
  return { response: 'Usage : `!source <id>` pour consulter une source (ou colle un lien pour l\'ajouter).', expectsReply: false }
}

// Fiche d'une source dans Discord : commentaires (modifiables), debunkages lies, texte integral.
function cmdFiche(args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!fiche <id>` (ou `!source <id>`)', expectsReply: false }
  const s = db.prepare('SELECT s.id, s.titre, s.url, s.completude, m.nom AS media FROM sources s LEFT JOIN medias m ON m.id = s.media_id WHERE s.id = ?').get(id) as { titre: string; completude: string | null; media: string | null } | undefined
  if (!s) return { response: `Source #${id} introuvable.`, expectsReply: false }
  const coms = db.prepare('SELECT c.id, c.type, c.contenu, u.nom AS auteur FROM commentaires c LEFT JOIN utilisateurs u ON u.id = c.auteur_id WHERE c.source_id = ? ORDER BY c.id').all(id) as { id: number; type: string; contenu: string; auteur: string | null }[]
  const debs = db.prepare("SELECT a.id, a.titre, asrc.role FROM activite_sources asrc JOIN activites a ON a.id = asrc.activite_id AND a.type = 'debunkage' WHERE asrc.source_id = ?").all(id) as { id: number; titre: string; role: string | null }[]
  const aTexte = db.prepare("SELECT 1 FROM archives WHERE source_id = ? AND contenu IS NOT NULL AND contenu != '' LIMIT 1").get(id)

  let r = `**${s.titre}**${s.media ? ` — ${s.media}` : ''}${s.completude ? ` _(${s.completude})_` : ''}\n${baseApp()}/lire/${id}\n\n`
  r += `**Commentaires (${coms.length})**\n`
  if (!coms.length) r += '_aucun_\n'
  else {
    for (const c of coms.slice(0, 10)) r += `• #${c.id} ${c.auteur || '?'} _(${c.type})_ : ${(c.contenu || '').slice(0, 140)}\n`
    r += '_Modifier : `!editcom <id> <nouveau texte>`_\n'
  }
  r += `\n**Débunkages (${debs.length})**\n`
  if (!debs.length) r += '_aucun_\n'
  else for (const d of debs) r += `• ${d.titre} _(${d.role || '—'})_ → ${baseApp()}/debunkages/${d.id}\n`
  if (aTexte) r += `\n**Texte intégral** : tape \`!texte ${id}\``
  return { response: r.slice(0, 1900), expectsReply: false }
}

// Edition d'un commentaire depuis Discord (auteur du commentaire, ou admin).
function cmdEditCommentaire(appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const m = (args || '').trim().match(/^(\d+)\s+([\s\S]+)$/)
  if (!m) return { response: 'Usage : `!editcom <id commentaire> <nouveau texte>`', expectsReply: false }
  const cid = parseInt(m[1])
  const texte = m[2].trim()
  const c = db.prepare('SELECT id, auteur_id FROM commentaires WHERE id = ?').get(cid) as { auteur_id: number | null } | undefined
  if (!c) return { response: `Commentaire #${cid} introuvable.`, expectsReply: false }
  const role = appUserId ? (db.prepare('SELECT role FROM utilisateurs WHERE id = ?').get(appUserId) as { role: string } | undefined)?.role : null
  const autorise = !!appUserId && (c.auteur_id === appUserId || c.auteur_id == null || role === 'admin')
  if (!autorise) return { response: 'Tu ne peux modifier que tes propres commentaires (renseigne ton pseudo Discord dans Mon espace pour être reconnu).', expectsReply: false }
  db.prepare('UPDATE commentaires SET contenu = ? WHERE id = ?').run(texte, cid)
  return { response: `Commentaire #${cid} mis à jour.`, expectsReply: false }
}

// Texte integral d'une source, decoupe en blocs (limite Discord 2000 c/message).
export function texteSourceChunks(args: string): string[] {
  const id = parseInt(args)
  if (isNaN(id)) return ['Usage : `!texte <id>`']
  const a = db.prepare("SELECT contenu FROM archives WHERE source_id = ? AND contenu IS NOT NULL AND contenu != '' ORDER BY id DESC LIMIT 1").get(id) as { contenu: string } | undefined
  if (!a) return [`Pas de texte intégral pour la source #${id}.`]
  const texte = String(a.contenu)
  const MAX = 1800, CAP = 8
  const chunks: string[] = []
  for (let i = 0; i < texte.length; i += MAX) chunks.push(texte.slice(i, i + MAX))
  if (chunks.length > CAP) {
    const reste = chunks.length - CAP
    chunks.length = CAP
    chunks.push(`… (${reste} bloc(s) en plus) — lire la suite dans l'app : ${baseApp()}/lire/${id}`)
  }
  chunks[0] = `**Texte intégral — source #${id}** (${chunks.length} message·s)\n\n${chunks[0]}`
  return chunks
}

function cmdScore(args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!score <id>`', expectsReply: false }

  const source = db.prepare('SELECT titre, date_publication, type_source FROM sources WHERE id = ?').get(id) as { titre: string; date_publication: string | null; type_source: string | null } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  const score = calculerScoreSource(id, source.date_publication, source.type_source)

  return {
    response: `**${source.titre}**\nScore : ${score.scoreTotal}/100 (pedagogie ${score.pedagogie}, echo ${score.echo})\nTiming : ${score.timing} | Fraicheur : ${Math.round(score.fraicheur * 100)}%`,
    expectsReply: false
  }
}

function cmdVivier(): { response: string; expectsReply: boolean } {
  const sources = db.prepare(`
    SELECT s.id, s.titre FROM sources s WHERE s.statut = 'vivier' ORDER BY s.soumis_le DESC LIMIT 5
  `).all() as { id: number; titre: string }[]

  if (sources.length === 0) return { response: 'Le vivier est vide.', expectsReply: false }

  const list = sources.map((s, i) => `${i + 1}. **${s.titre}** (#${s.id})`).join('\n')
  return { response: `**Top 5 du vivier :**\n${list}`, expectsReply: false }
}

function cmdAtelier(): { response: string; expectsReply: boolean } {
  const atelier = db.prepare(`
    SELECT p.numero, p.date_atelier, p.lieu, a.statut
    FROM activites a
    JOIN atelier_pipeline p ON p.activite_id = a.id
    WHERE a.type = 'atelier' AND a.statut IN ('preparation', 'pret')
    ORDER BY p.date_atelier ASC LIMIT 1
  `).get() as { numero: number; date_atelier: string; lieu: string; statut: string } | undefined

  if (!atelier) return { response: 'Aucun atelier programme pour le moment.', expectsReply: false }

  return {
    response: `**Prochain atelier : #${atelier.numero}**\nDate : ${atelier.date_atelier || 'a definir'}\nLieu : ${atelier.lieu || 'a definir'}\nStatut : ${atelier.statut}`,
    expectsReply: false
  }
}

function cmdAide(): { response: string; expectsReply: boolean } {
  return {
    response: `**📖 Manuel — À la source**

**Poster une source** : colle un lien d'article, il rejoint la veille et t'est attribué (renseigne ton pseudo Discord dans l'app : Mon espace → Mon compte). Du texte en plus du lien devient un commentaire. Le bot te répond avec le lien pour la lire et la commenter.

**Article payant (Europresse)** : joins le **PDF intégral** dans le **même message** que le lien → copie hors-ligne lisible dans l'app (texte extrait). Tu peux aussi joindre un **.ris** (métadonnées). Version sans paywall ? **Édite** ton message et ajoute le lien.

**Consulter une source** : \`!source <id>\` ou \`!fiche <id>\` (commentaires, débunkages liés, texte) · \`!texte <id>\` texte intégral · \`!editcom <id> <texte>\` modifier un commentaire.

**Commandes** :
\`!aide\` ce manuel · \`!vivier\` top 5 du vivier · \`!atelier\` prochain atelier
\`!score <id>\` · \`!analyser <id>\` · \`!evaluer <id>\` · \`!commenter <id>\` · \`!taguer <id>\` · \`!archiver <id>\`
\`!abandon\` (ou \`!annuler\` / \`!stop\`) pour quitter une discussion en cours`,
    expectsReply: false
  }
}

// --- Commandes conversationnelles ---

function cmdAnalyser(userId: string, appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!analyser <id>`', expectsReply: false }

  // L'analyse crédite son auteur (source_mecanismes.identifie_par) : sans membre
  // rapproché, on refuse proprement plutôt que de poser une contribution anonyme.
  if (appUserId == null) {
    return { response: 'Pour analyser via le bot, renseigne d\'abord ton pseudo Discord dans l\'app (Mon espace → Mon compte).', expectsReply: false }
  }

  const source = db.prepare('SELECT titre FROM sources WHERE id = ?').get(id) as { titre: string } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  const mecanismes = db.prepare('SELECT id, nom FROM mecanismes_reference ORDER BY id').all() as { id: number; nom: string }[]
  const list = mecanismes.map((m) => `${m.id}. ${m.nom}`).join('\n')

  conversations.set(userId, { userId, command: 'analyser', sourceId: id, step: 1, data: { appUserId } })

  return {
    response: `**Analyse de : ${source.titre}**\n\nQuel mecanisme identifiez-vous ?\n${list}\n\n(Repondez avec le numero)`,
    expectsReply: true
  }
}

function stepAnalyser(conv: ConversationState, message: string): { response: string; expectsReply: boolean; done: boolean } {
  switch (conv.step) {
    case 1: {
      const mecaId = parseInt(message)
      if (isNaN(mecaId)) return { response: 'Repondez avec un numero de mecanisme.', expectsReply: true, done: false }
      conv.data.mecanisme_id = mecaId
      conv.step = 2
      return { response: 'Quel extrait illustre ce mecanisme ? (copiez le passage)', expectsReply: true, done: false }
    }
    case 2: {
      conv.data.extrait = message
      conv.step = 3
      return { response: 'Justifiez en une phrase :', expectsReply: true, done: false }
    }
    case 3: {
      conv.data.justification = message
      const auteurId = (conv.data.appUserId as number | null) ?? null
      if (auteurId == null) {
        conversations.delete(conv.userId)
        return { response: 'Analyse non enregistrée : renseigne ton pseudo Discord dans l\'app (Mon espace → Mon compte).', expectsReply: false, done: true }
      }
      // Dédup : une seule justification par couple source / mécanisme / auteur.
      // Réanalyser le même mécanisme met à jour la justification et l'extrait.
      const ex = db.prepare('SELECT id FROM source_mecanismes WHERE source_id = ? AND mecanisme_id = ? AND identifie_par = ?')
        .get(conv.sourceId, conv.data.mecanisme_id, auteurId) as { id: number } | undefined
      if (ex) {
        db.prepare('UPDATE source_mecanismes SET justification = ?, extrait = ? WHERE id = ?')
          .run(conv.data.justification, conv.data.extrait, ex.id)
      } else {
        db.prepare(`
          INSERT INTO source_mecanismes (source_id, mecanisme_id, identifie_par, justification, extrait)
          VALUES (?, ?, ?, ?, ?)
        `).run(conv.sourceId, conv.data.mecanisme_id, auteurId, conv.data.justification, conv.data.extrait)
      }

      conv.step = 4
      return { response: 'Mecanisme enregistre ! Un autre mecanisme ? (oui/non)', expectsReply: true, done: false }
    }
    case 4: {
      if (message.toLowerCase().startsWith('oui')) {
        conv.step = 1
        conv.data = { appUserId: conv.data.appUserId }
        const mecanismes = db.prepare('SELECT id, nom FROM mecanismes_reference ORDER BY id').all() as { id: number; nom: string }[]
        const list = mecanismes.map((m) => `${m.id}. ${m.nom}`).join('\n')
        return { response: `Quel mecanisme ?\n${list}`, expectsReply: true, done: false }
      }
      conversations.delete(conv.userId)
      return { response: 'Analyse terminee. Merci pour votre contribution !', expectsReply: false, done: true }
    }
    default:
      conversations.delete(conv.userId)
      return { response: 'Conversation terminee.', expectsReply: false, done: true }
  }
}

function cmdEvaluer(userId: string, appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!evaluer <id>`', expectsReply: false }

  // L'évaluation est attribuée à son auteur (evaluateur_id, NOT NULL, UNIQUE par
  // source). Sans membre rapproché, on refuse plutôt que de tout créditer au #1.
  if (appUserId == null) {
    return { response: 'Pour évaluer via le bot, renseigne d\'abord ton pseudo Discord dans l\'app (Mon espace → Mon compte).', expectsReply: false }
  }

  const source = db.prepare('SELECT titre FROM sources WHERE id = ?').get(id) as { titre: string } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  conversations.set(userId, { userId, command: 'evaluer', sourceId: id, step: 1, data: { appUserId } })

  return {
    response: `**Evaluation de : ${source.titre}**\n\nComplexite du sujet ? (0-10)`,
    expectsReply: true
  }
}

function stepEvaluer(conv: ConversationState, message: string): { response: string; expectsReply: boolean; done: boolean } {
  const val = parseInt(message)

  switch (conv.step) {
    case 1: {
      if (isNaN(val) || val < 0 || val > 10) return { response: 'Un chiffre entre 0 et 10 :', expectsReply: true, done: false }
      conv.data.complexite = val
      conv.step = 2
      return { response: 'Resonance aupres du public ? (0-10)', expectsReply: true, done: false }
    }
    case 2: {
      if (isNaN(val) || val < 0 || val > 10) return { response: 'Un chiffre entre 0 et 10 :', expectsReply: true, done: false }
      conv.data.resonance = val
      conv.step = 3
      return { response: 'Bonus expert·e ? (0-10)', expectsReply: true, done: false }
    }
    case 3: {
      if (isNaN(val) || val < 0 || val > 10) return { response: 'Un chiffre entre 0 et 10 :', expectsReply: true, done: false }
      conv.data.bonus_expert = val
      conv.step = 4
      return { response: 'Viralite ? (1=confidentiel, 2=circule, 3=viral, 4=tres viral)', expectsReply: true, done: false }
    }
    case 4: {
      const viraliteMap: Record<string, string> = { '1': 'confidentiel', '2': 'circule', '3': 'viral', '4': 'tres_viral' }
      const viralite = viraliteMap[message.trim()] || 'confidentiel'

      // Évaluation attribuée au membre rapproché (plus de #1 codé en dur). Refus
      // propre si l'auteur n'est pas identifié, pour ne pas écraser une autre éval.
      const evaluateurId = (conv.data.appUserId as number | null) ?? null
      if (evaluateurId == null) {
        conversations.delete(conv.userId)
        return { response: 'Évaluation non enregistrée : renseigne ton pseudo Discord dans l\'app (Mon espace → Mon compte).', expectsReply: false, done: true }
      }
      db.prepare(`
        INSERT INTO evaluations (source_id, evaluateur_id, complexite, bonus_expert, resonance)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(source_id, evaluateur_id) DO UPDATE SET
          complexite = excluded.complexite,
          bonus_expert = excluded.bonus_expert,
          resonance = excluded.resonance,
          evaluee_le = CURRENT_TIMESTAMP
      `).run(conv.sourceId, evaluateurId, conv.data.complexite, conv.data.bonus_expert, conv.data.resonance)

      // Mettre a jour viralite sur la source
      db.prepare('UPDATE sources SET viralite_qualitative = ? WHERE id = ?').run(viralite, conv.sourceId)

      conversations.delete(conv.userId)
      return { response: `Evaluation enregistree ! Complexite ${conv.data.complexite}/10, Resonance ${conv.data.resonance}/10, Expert ${conv.data.bonus_expert}/10, Viralite: ${viralite}`, expectsReply: false, done: true }
    }
    default:
      conversations.delete(conv.userId)
      return { response: 'Evaluation terminee.', expectsReply: false, done: true }
  }
}

function cmdCommenter(userId: string, appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!commenter <id>`', expectsReply: false }

  conversations.set(userId, { userId, command: 'commenter', sourceId: id, step: 1, data: { appUserId } })

  return {
    response: 'Type de commentaire ? (1=commentaire, 2=analyse, 3=question, 4=lien)',
    expectsReply: true
  }
}

function stepCommenter(conv: ConversationState, message: string): { response: string; expectsReply: boolean; done: boolean } {
  switch (conv.step) {
    case 1: {
      const typeMap: Record<string, string> = { '1': 'commentaire', '2': 'analyse', '3': 'question', '4': 'lien' }
      conv.data.type = typeMap[message.trim()] || 'commentaire'
      conv.step = 2
      return { response: 'Votre commentaire :', expectsReply: true, done: false }
    }
    case 2: {
      // commentaires.auteur_id est NOT NULL : sans membre rapproche, l'INSERT
      // echouerait. On le refuse proprement et on explique comment etre reconnu.
      const auteurId = (conv.data.appUserId as number | null) ?? null
      if (auteurId == null) {
        conversations.delete(conv.userId)
        return { response: 'Pour commenter via le bot, renseigne d\'abord ton pseudo Discord dans l\'app (Mon espace → Mon compte).', expectsReply: false, done: true }
      }
      db.prepare(`
        INSERT INTO commentaires (source_id, auteur_id, type, contenu, origine) VALUES (?, ?, ?, ?, 'discord')
      `).run(conv.sourceId, auteurId, conv.data.type, message)

      conversations.delete(conv.userId)
      return { response: 'Commentaire enregistre ! Tu peux le modifier ici avec `!editcom`, ou dans l\'app.', expectsReply: false, done: true }
    }
    default:
      conversations.delete(conv.userId)
      return { response: 'Termine.', expectsReply: false, done: true }
  }
}

function cmdTaguer(userId: string, appUserId: number | null, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!taguer <id>`', expectsReply: false }

  const tags = db.prepare('SELECT id, nom FROM tags ORDER BY nom').all() as { id: number; nom: string }[]
  const existing = db.prepare(`
    SELECT t.nom FROM tags t JOIN source_tags st ON st.tag_id = t.id WHERE st.source_id = ?
  `).all(id) as { nom: string }[]

  conversations.set(userId, { userId, command: 'taguer', sourceId: id, step: 1, data: { appUserId } })

  const existingStr = existing.length > 0 ? `Tags actuels : ${existing.map(t => t.nom).join(', ')}` : 'Aucun tag actuellement.'
  const list = tags.map(t => t.nom).join(', ')

  return {
    response: `${existingStr}\n\nTags disponibles : ${list}\n\nQuel tag ajouter ? (nom exact ou nouveau)`,
    expectsReply: true
  }
}

function stepTaguer(conv: ConversationState, message: string): { response: string; expectsReply: boolean; done: boolean } {
  const tagNom = message.trim().toLowerCase()
  if (!tagNom || tagNom === 'fin' || tagNom === 'stop') {
    conversations.delete(conv.userId)
    return { response: 'Tagage termine.', expectsReply: false, done: true }
  }

  // Trouver ou creer le tag
  let tagRow = db.prepare('SELECT id FROM tags WHERE nom = ?').get(tagNom) as { id: number } | undefined
  if (!tagRow) {
    const r = db.prepare("INSERT INTO tags (nom, categorie) VALUES (?, 'libre')").run(tagNom)
    tagRow = { id: Number(r.lastInsertRowid) }
  }

  const ajoutePar = (conv.data.appUserId as number | null) ?? null
  db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id, ajoute_par) VALUES (?, ?, ?)').run(conv.sourceId, tagRow.id, ajoutePar)

  return { response: `Tag "${tagNom}" ajoute ! Un autre ? (ou "fin" pour terminer)`, expectsReply: true, done: false }
}

// Validation synchrone de `!archiver <id>` (usage / source introuvable / pas d'URL).
// L'archivage réel est fait par archiverSource() (async), appelé par le client.
function cmdArchiverHint(args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!archiver <id>`', expectsReply: false }
  return { response: '', expectsReply: false }
}

/**
 * Archive RÉELLEMENT une source via le pipeline readability (le même que la route
 * POST /api/sources/:id/archiver). Extrait le texte, insère une archive 'readability'
 * et renvoie un compte rendu honnête (succès, déjà archivé, échec). Synchrone côté
 * appelant via await ; à brancher depuis le client Discord.
 */
export async function archiverSource(args: string, appUserId: number | null): Promise<string> {
  const id = parseInt(args)
  if (isNaN(id)) return 'Usage : `!archiver <id>`'

  const source = db.prepare('SELECT url, titre, paywall FROM sources WHERE id = ?').get(id) as { url: string | null; titre: string; paywall: number } | undefined
  if (!source) return `Source #${id} introuvable.`
  if (!source.url) return `Source #${id} n'a pas d'URL. Joins un fichier (PDF, capture) en pièce jointe et je le lierai à la source.`

  // Déjà archivée (texte présent) : ne pas réécraser, le signaler.
  const dejaTexte = db.prepare("SELECT 1 FROM archives WHERE source_id = ? AND contenu IS NOT NULL AND contenu != '' LIMIT 1").get(id)
  if (dejaTexte) return `Source #${id} déjà archivée. Texte intégral : \`!texte ${id}\` · ${baseApp()}/lire/${id}`

  try {
    const article = await extractReadability(source.url)
    if (!article) {
      return `Échec de l'archivage de **${source.titre}** (extraction impossible). Joins un PDF/capture en pièce jointe et je le lierai à la source.`
    }
    const nbMots = compterMots(article.content)
    const statut = detecterArchivePartielle(article.textContent, source.paywall)
    if (article.motsCles && article.motsCles.length > 0) {
      try { db.prepare('UPDATE sources SET mots_cles = ? WHERE id = ?').run(article.motsCles.join(', '), id) } catch { /* colonne optionnelle */ }
    }
    db.prepare(`
      INSERT INTO archives (source_id, type, contenu, cree_par, nb_mots, statut)
      VALUES (?, 'readability', ?, ?, ?, ?)
    `).run(id, article.content, appUserId, nbMots, statut)
    const mention = statut === 'partielle' ? ' _(archive partielle — paywall probable, joins un PDF pour le texte intégral)_' : ''
    return `📦 Archivé : **${source.titre}** (${nbMots} mots)${mention}\n${baseApp()}/lire/${id}`
  } catch (err) {
    console.error('Discord: echec archiverSource', err)
    return `Échec de l'archivage de **${source.titre}**. Réessaie, ou joins un fichier en pièce jointe.`
  }
}

// Abandon de la conversation/assistant en cours pour l'utilisateur.
function cmdAbandon(userId: string): { response: string; expectsReply: boolean } {
  if (conversations.has(userId)) {
    conversations.delete(userId)
    return { response: 'Discussion abandonnée. Tu peux repartir d\'une commande quand tu veux (`!aide`).', expectsReply: false }
  }
  return { response: 'Aucune discussion en cours.', expectsReply: false }
}

/**
 * Gestion d'un upload de piece jointe (fallback quand readability echoue)
 */
export function handleAttachment(sourceId: number, filename: string, _filePath: string): string {
  // En production : copier le fichier dans uploads/, creer une archive de type 'pdf' ou 'html'
  db.prepare(`
    INSERT INTO archives (source_id, type, chemin, cree_le) VALUES (?, 'pdf', ?, CURRENT_TIMESTAMP)
  `).run(sourceId, `uploads/${filename}`)

  return `Piece jointe "${filename}" attachee a la source #${sourceId}.`
}

/**
 * Verifier si un utilisateur est en conversation active
 */
export function hasActiveConversation(userId: string): boolean {
  return conversations.has(userId)
}
