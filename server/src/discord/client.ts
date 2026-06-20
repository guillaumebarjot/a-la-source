/**
 * Client Discord d'ingestion (gateway) — sens entrant.
 *
 * Sur le canal de veille surveille :
 *  - liens postes -> sources en inbox (attribuees), le bot REPOND avec le lien
 *    vers l'article dans À la source ;
 *  - pieces jointes PDF -> copie integrale hors-ligne lisible dans l'app ;
 *  - pieces jointes .ris -> metadonnees ;
 *  - texte en plus du lien -> commentaire sur la source ;
 *  - editions (ajout d'une PJ ou d'une version sans paywall) et reponses Discord
 *    -> rattachees a la bonne source (mapping discord_messages) ;
 *  - commandes ! (aide, vivier, atelier, analyser, evaluer...) branchees.
 *
 * ROBUSTESSE BOOT : ne throw jamais. Sans token, logge et ne fait rien.
 */

import db from '../lib/db.js'
import { getDiscordConfig, handleCommand, handleReply, hasActiveConversation } from './bot.js'
import { traiterMessage, sourcePourMessage, type PieceJointe } from './ingestion.js'

/**
 * Rapproche un auteur Discord (id stable, sinon un de ses noms) d'un compte membre.
 * Insensible a la casse : un membre peut renseigner son pseudo de l'app avec son
 * @handle (ex. hydro_looney) ou son nom affiche (ex. Guillaume).
 */
function trouverMembreDiscord(discordId: string, noms: string[]): number | null {
  let u = db.prepare('SELECT id FROM utilisateurs WHERE discord_id = ? AND actif = 1')
    .get(discordId) as { id: number } | undefined
  if (u) return u.id
  const candidats = Array.from(new Set(noms.map((n) => n.trim().toLowerCase()).filter(Boolean)))
  for (const nom of candidats) {
    u = db.prepare('SELECT id FROM utilisateurs WHERE LOWER(discord_pseudo) = ? AND actif = 1')
      .get(nom) as { id: number } | undefined
    if (u) {
      try { db.prepare('UPDATE utilisateurs SET discord_id = ? WHERE id = ? AND (discord_id IS NULL OR discord_id = "")').run(discordId, u.id) } catch { /* best-effort */ }
      return u.id
    }
  }
  return null
}

// Adaptateur : message discord.js -> liste de pieces jointes neutres.
function piecesJointes(message: { attachments: { values(): Iterable<{ url: string; name: string | null; contentType: string | null }> } }): PieceJointe[] {
  return Array.from(message.attachments.values()).map((a) => ({
    url: a.url,
    nom: a.name || '',
    contentType: a.contentType,
  }))
}

export async function startDiscordBot(): Promise<void> {
  try {
    const config = getDiscordConfig()
    if (!config || !config.token) {
      console.log('Discord non configure, ingestion inactive')
      return
    }

    const channelVeille = config.channelVeille || ''
    const guildIds = config.guildIds || []

    const { Client, GatewayIntentBits, Events, Partials } = await import('discord.js')

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      // Partials.Message : recevoir les editions de messages non encore en cache.
      partials: [Partials.Message, Partials.Channel],
    })

    const estSurveille = (channelId: string, guildId: string): boolean => {
      const dansCanal = channelVeille ? channelId === channelVeille : false
      const dansGuilde = guildIds.length > 0 ? guildIds.includes(guildId) : false
      return dansCanal || dansGuilde
    }

    // Resout l'auteur du message en compte membre (attribution).
    const auteurMembre = (message: any): number | null => trouverMembreDiscord(
      message.author?.id || '',
      [
        message.author?.username || '',
        message.author?.globalName || '',
        message.member?.nickname || '',
        message.member?.displayName || '',
      ],
    )

    client.once(Events.ClientReady, (c) => {
      console.log(`Discord connecte, ingestion active (${c.user.tag})`)
      if (channelVeille) console.log(`Discord: canal de veille surveille = ${channelVeille}`)
      if (guildIds.length) console.log(`Discord: guildes surveillees = ${guildIds.join(', ')}`)
    })

    client.on(Events.MessageCreate, async (message) => {
      try {
        if (message.author?.bot || message.webhookId) return
        if (!estSurveille(message.channelId, message.guildId || '')) return

        const contenu = message.content || ''
        const authorId = message.author?.id || ''

        // Commandes ! (et reponses a une conversation en cours)
        if (contenu.trim().startsWith('!')) {
          const parts = contenu.trim().split(/\s+/)
          const { response } = handleCommand(authorId, parts[0], parts.slice(1).join(' '))
          if (response) await message.reply(response).catch(() => {})
          return
        }
        if (hasActiveConversation(authorId)) {
          const { response } = handleReply(authorId, contenu)
          if (response) await message.reply(response).catch(() => {})
          return
        }

        // Reponse Discord a un message deja ingere -> rattachement a sa source.
        const refId = (message.reference && message.reference.messageId) || undefined
        const sourceExistante = refId ? sourcePourMessage(refId) : null

        const { lignes } = await traiterMessage({
          messageId: message.id,
          channelId: message.channelId,
          texte: contenu,
          pjs: piecesJointes(message),
          soumisPar: auteurMembre(message),
          sourceExistante,
        })
        if (lignes.length) await message.reply(lignes.join('\n')).catch(() => {})
      } catch (err) {
        console.error('Discord: erreur de traitement de message', err)
      }
    })

    // Editions : ajout d'une PJ (PDF), d'une version sans paywall, d'un commentaire...
    client.on(Events.MessageUpdate, async (_old, updated) => {
      try {
        const message: any = updated.partial ? await updated.fetch() : updated
        if (message.author?.bot || message.webhookId) return
        if (!estSurveille(message.channelId, message.guildId || '')) return

        const { lignes } = await traiterMessage({
          messageId: message.id,
          channelId: message.channelId,
          texte: message.content || '',
          pjs: piecesJointes(message),
          soumisPar: auteurMembre(message),
          sourceExistante: sourcePourMessage(message.id),
        })
        if (lignes.length) await message.reply(lignes.join('\n')).catch(() => {})
      } catch (err) {
        console.error('Discord: erreur de traitement d\'edition', err)
      }
    })

    client.on(Events.Error, (err) => {
      console.error('Discord: erreur client', err)
    })

    await client.login(config.token)
  } catch (err) {
    console.error('Discord: demarrage impossible, ingestion inactive', err)
  }
}
