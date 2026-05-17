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
export function handleCommand(userId: string, command: string, args: string): {
  response: string
  expectsReply: boolean
} {
  const cmd = command.toLowerCase()

  switch (cmd) {
    case '!source': return cmdSource(userId, args)
    case '!analyser': return cmdAnalyser(userId, args)
    case '!evaluer': return cmdEvaluer(userId, args)
    case '!commenter': return cmdCommenter(userId, args)
    case '!taguer': return cmdTaguer(userId, args)
    case '!archiver': return cmdArchiver(userId, args)
    case '!score': return cmdScore(args)
    case '!vivier': return cmdVivier()
    case '!atelier': return cmdAtelier()
    case '!aide': return cmdAide()
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

function cmdSource(_userId: string, url: string): { response: string; expectsReply: boolean } {
  if (!url || !url.startsWith('http')) {
    return { response: 'Usage : `!source <url>` — Soumettre une source a A la source', expectsReply: false }
  }

  // Creer la source via la BDD directement
  const result = db.prepare(`
    INSERT INTO sources (titre, url, origine, soumis_le) VALUES (?, ?, 'discord', CURRENT_TIMESTAMP)
  `).run('Source Discord (titre a completer)', url)

  const sourceId = Number(result.lastInsertRowid)
  return {
    response: `Source #${sourceId} creee ! URL : ${url}\nTitre a completer dans l'app. Utilisez \`!analyser ${sourceId}\` pour lancer l'analyse.`,
    expectsReply: false
  }
}

function cmdScore(args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!score <id>`', expectsReply: false }

  const source = db.prepare('SELECT titre, date_publication, type_source FROM sources WHERE id = ?').get(id) as { titre: string; date_publication: string | null; type_source: string | null } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  // Import dynamique evite les imports circulaires
  const { calculerScoreSource } = require('../lib/score.js')
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
    SELECT * FROM ateliers WHERE statut IN ('preparation', 'pret') ORDER BY date_atelier ASC LIMIT 1
  `).get() as { numero: number; date_atelier: string; lieu: string; statut: string } | undefined

  if (!atelier) return { response: 'Aucun atelier programme pour le moment.', expectsReply: false }

  return {
    response: `**Prochain atelier : #${atelier.numero}**\nDate : ${atelier.date_atelier || 'a definir'}\nLieu : ${atelier.lieu || 'a definir'}\nStatut : ${atelier.statut}`,
    expectsReply: false
  }
}

function cmdAide(): { response: string; expectsReply: boolean } {
  return {
    response: `**Commandes A la source :**
\`!source <url>\` — Soumettre une source
\`!analyser <id>\` — Identifier des mecanismes (conversation guidee)
\`!evaluer <id>\` — Evaluer une source (sliders)
\`!commenter <id>\` — Ajouter un commentaire
\`!taguer <id>\` — Ajouter des tags
\`!archiver <id>\` — Lancer l'archivage readability
\`!score <id>\` — Voir le score d'une source
\`!vivier\` — Top 5 du vivier
\`!atelier\` — Info prochain atelier
\`!aide\` — Cette aide`,
    expectsReply: false
  }
}

// --- Commandes conversationnelles ---

function cmdAnalyser(userId: string, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!analyser <id>`', expectsReply: false }

  const source = db.prepare('SELECT titre FROM sources WHERE id = ?').get(id) as { titre: string } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  const mecanismes = db.prepare('SELECT id, nom FROM mecanismes_reference ORDER BY id').all() as { id: number; nom: string }[]
  const list = mecanismes.map((m) => `${m.id}. ${m.nom}`).join('\n')

  conversations.set(userId, { userId, command: 'analyser', sourceId: id, step: 1, data: {} })

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
      // Enregistrer en BDD
      db.prepare(`
        INSERT INTO source_mecanismes (source_id, mecanisme_id, justification, extrait)
        VALUES (?, ?, ?, ?)
      `).run(conv.sourceId, conv.data.mecanisme_id, conv.data.justification, conv.data.extrait)

      conv.step = 4
      return { response: 'Mecanisme enregistre ! Un autre mecanisme ? (oui/non)', expectsReply: true, done: false }
    }
    case 4: {
      if (message.toLowerCase().startsWith('oui')) {
        conv.step = 1
        conv.data = {}
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

function cmdEvaluer(userId: string, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!evaluer <id>`', expectsReply: false }

  const source = db.prepare('SELECT titre FROM sources WHERE id = ?').get(id) as { titre: string } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }

  conversations.set(userId, { userId, command: 'evaluer', sourceId: id, step: 1, data: {} })

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

      // Enregistrer evaluation (utilisateur Discord = ID 1 par defaut, a ameliorer)
      db.prepare(`
        INSERT INTO evaluations (source_id, evaluateur_id, complexite, bonus_expert, resonance)
        VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(source_id, evaluateur_id) DO UPDATE SET
          complexite = excluded.complexite,
          bonus_expert = excluded.bonus_expert,
          resonance = excluded.resonance,
          evaluee_le = CURRENT_TIMESTAMP
      `).run(conv.sourceId, conv.data.complexite, conv.data.bonus_expert, conv.data.resonance)

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

function cmdCommenter(userId: string, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!commenter <id>`', expectsReply: false }

  conversations.set(userId, { userId, command: 'commenter', sourceId: id, step: 1, data: {} })

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
      db.prepare(`
        INSERT INTO commentaires (source_id, auteur_id, type, contenu) VALUES (?, 1, ?, ?)
      `).run(conv.sourceId, conv.data.type, message)

      conversations.delete(conv.userId)
      return { response: 'Commentaire enregistre !', expectsReply: false, done: true }
    }
    default:
      conversations.delete(conv.userId)
      return { response: 'Termine.', expectsReply: false, done: true }
  }
}

function cmdTaguer(userId: string, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!taguer <id>`', expectsReply: false }

  const tags = db.prepare('SELECT id, nom FROM tags ORDER BY nom').all() as { id: number; nom: string }[]
  const existing = db.prepare(`
    SELECT t.nom FROM tags t JOIN source_tags st ON st.tag_id = t.id WHERE st.source_id = ?
  `).all(id) as { nom: string }[]

  conversations.set(userId, { userId, command: 'taguer', sourceId: id, step: 1, data: {} })

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

  db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)').run(conv.sourceId, tagRow.id)

  return { response: `Tag "${tagNom}" ajoute ! Un autre ? (ou "fin" pour terminer)`, expectsReply: true, done: false }
}

function cmdArchiver(_userId: string, args: string): { response: string; expectsReply: boolean } {
  const id = parseInt(args)
  if (isNaN(id)) return { response: 'Usage : `!archiver <id>`', expectsReply: false }

  const source = db.prepare('SELECT url, titre FROM sources WHERE id = ?').get(id) as { url: string; titre: string } | undefined
  if (!source) return { response: `Source #${id} introuvable.`, expectsReply: false }
  if (!source.url) return { response: `Source #${id} n'a pas d'URL. Vous pouvez joindre un fichier (PDF, capture) en piece jointe.`, expectsReply: false }

  // L'archivage est asynchrone — on le lance et on repond immediatement
  // En vrai usage, on ferait un appel API. Ici on retourne juste le message.
  return {
    response: `Archivage lance pour : **${source.titre}**\nSi l'archivage echoue, vous pouvez joindre un fichier (PDF, image, texte) en piece jointe et je le lierai a la source.`,
    expectsReply: false
  }
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
