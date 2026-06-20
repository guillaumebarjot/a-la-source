/**
 * Client Discord d'ingestion vers l'inbox a qualifier.
 *
 * Ecoute les canaux surveilles et, des qu'un message contient une URL d'article,
 * cree une source en inbox (a_qualifier = 1, statut 'veille', origine 'discord').
 * Le titre est rempli au mieux via OpenGraph ; a defaut, on garde l'URL.
 *
 * ROBUSTESSE BOOT : ce module ne doit JAMAIS casser le demarrage du serveur.
 * - Sans config (pas de token), il logge et ne fait rien.
 * - Toute la mise en route est enveloppee dans des try/catch ; on ne throw jamais.
 *
 * Activation : definir DISCORD_TOKEN + (DISCORD_CHANNEL_VEILLE ou DISCORD_GUILD_IDS),
 * via variables d'environnement ou via le parametre BDD 'discord'.
 */

import db from '../lib/db.js'
import { getDiscordConfig } from './bot.js'
import { fetchOpenGraph } from '../lib/opengraph.js'

// Detecte les URLs http(s) dans un texte libre.
const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi

/**
 * Nettoie une URL detectee dans un message (retire la ponctuation de fin courante).
 */
function nettoyerUrl(brut: string): string {
  return brut.replace(/[.,;:!?]+$/, '').trim()
}

/**
 * Rapproche un auteur Discord (id stable, sinon pseudo) d'un compte membre.
 * Renvoie l'id utilisateur a crediter, ou null si inconnu.
 * Si on retrouve le membre par son pseudo et que son discord_id n'est pas encore
 * connu, on le memorise (l'id Discord est stable, le pseudo peut changer).
 */
function trouverMembreDiscord(discordId: string, noms: string[]): number | null {
  let u = db.prepare('SELECT id FROM utilisateurs WHERE discord_id = ? AND actif = 1')
    .get(discordId) as { id: number } | undefined
  if (u) return u.id
  // On rapproche par n'importe lequel des noms Discord (handle, nom global, surnom
  // de serveur), insensible a la casse : un membre peut renseigner son pseudo de
  // l'app avec son @handle (ex. hydro_looney) ou son nom affiche (ex. Guillaume).
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

/**
 * Cree une source en inbox a partir d'une URL, sans doublon d'URL.
 * Titre best-effort via OpenGraph ; a defaut, l'URL elle-meme.
 * soumisPar : id du membre a crediter (auteur Discord rapproche), ou null.
 * Tout est defensif : en cas d'erreur, on logge et on continue.
 */
async function ingererUrl(url: string, soumisPar: number | null): Promise<void> {
  try {
    const existe = db.prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: number } | undefined
    if (existe) return

    let titre = url
    try {
      const og = await fetchOpenGraph(url)
      if (og.title) titre = og.title
      else {
        try { titre = new URL(url).hostname } catch { /* garde l'URL */ }
      }
    } catch {
      // enrichissement best-effort : on garde l'URL comme titre
    }

    // Double-verification anti-doublon (course possible pendant le fetch)
    const existeApres = db.prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: number } | undefined
    if (existeApres) return

    db.prepare(`
      INSERT INTO sources (titre, url, origine, statut, a_qualifier, soumis_par)
      VALUES (?, ?, 'discord', 'veille', 1, ?)
    `).run(titre, url, soumisPar)

    console.log(`Discord: source ingeree en inbox a qualifier — ${url}${soumisPar ? ` (creditee au membre #${soumisPar})` : ''}`)
  } catch (err) {
    console.error('Discord: echec ingestion URL', url, err)
  }
}

/**
 * Demarre le client Discord d'ingestion si une config existe.
 * Ne throw jamais : robustesse boot.
 */
export async function startDiscordBot(): Promise<void> {
  try {
    const config = getDiscordConfig()
    if (!config || !config.token) {
      console.log('Discord non configure, ingestion inactive')
      return
    }

    // Canaux surveilles : le canal de veille explicite, sinon tous les canaux des guildes listees.
    const channelVeille = config.channelVeille || ''
    const guildIds = config.guildIds || []

    // Import dynamique : discord.js n'est charge que si on a une config valide.
    const { Client, GatewayIntentBits, Events } = await import('discord.js')

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    })

    client.once(Events.ClientReady, (c) => {
      console.log(`Discord connecte, ingestion active (${c.user.tag})`)
      if (channelVeille) console.log(`Discord: canal de veille surveille = ${channelVeille}`)
      if (guildIds.length) console.log(`Discord: guildes surveillees = ${guildIds.join(', ')}`)
    })

    client.on(Events.MessageCreate, (message) => {
      try {
        if (message.author?.bot) return

        // Le message est-il dans un canal surveille ?
        const channelId = message.channelId
        const guildId = message.guildId || ''
        const dansCanalVeille = channelVeille ? channelId === channelVeille : false
        const dansGuilde = guildIds.length > 0 ? guildIds.includes(guildId) : false
        // Si aucun filtre n'est defini, on ne surveille rien (securite).
        const surveille = dansCanalVeille || dansGuilde
        if (!surveille) return

        const contenu = message.content || ''
        const matches = contenu.match(URL_REGEX)
        if (!matches) return

        // Attribution : rapproche l'auteur Discord d'un compte membre (sinon NULL).
        // On essaie le handle, le nom global et le surnom de serveur.
        const soumisPar = trouverMembreDiscord(message.author?.id || '', [
          message.author?.username || '',
          message.author?.globalName || '',
          message.member?.nickname || '',
          message.member?.displayName || '',
        ])

        const urls = Array.from(new Set(matches.map(nettoyerUrl).filter(Boolean)))
        for (const url of urls) {
          // Fire-and-forget : ingererUrl gere ses propres erreurs.
          void ingererUrl(url, soumisPar)
        }
      } catch (err) {
        console.error('Discord: erreur de traitement de message', err)
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
