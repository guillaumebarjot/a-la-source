/**
 * Notifications App -> Discord via webhook (sens sortant).
 *
 * Poste un message dans le salon dedie du serveur Discord quand un contenu est
 * publie (sujet, dossier/decryptage, debunkage). Ne necessite PAS de bot : un
 * simple webhook suffit pour ecrire (l'ingestion entrante, elle, demande le bot).
 *
 * Configuration : DISCORD_WEBHOOK_URL (secret, dans /srv/a-la-source/.env).
 * Base des liens : PUBLIC_BASE_URL (defaut https://alasource.rouge-coquelicot.fr).
 *
 * ROBUSTESSE : ne throw jamais, ne bloque jamais la requete appelante.
 * Sans webhook configure, c'est un no-op silencieux.
 */

const COULEUR_RC = 0xc8102e // rouge coquelicot

export interface NotifPublication {
  type: string          // libelle affiche (ex. « Sujet », « Debunkage »)
  titre: string
  chemin?: string       // chemin relatif dans l'app (ex. /sujets/pfas)
  description?: string
}

/**
 * Envoie une notification de publication. Fire-and-forget cote appelant :
 * `void notifierPublication(...)`. Toute erreur est avalee et journalisee.
 */
export async function notifierPublication(notif: NotifPublication): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (!webhook) return

  try {
    const base = process.env.PUBLIC_BASE_URL || 'https://alasource.rouge-coquelicot.fr'
    const lien = notif.chemin ? `${base}${notif.chemin}` : undefined
    const embed: Record<string, unknown> = {
      title: notif.titre,
      footer: { text: `À la source · ${notif.type}` },
      color: COULEUR_RC,
    }
    if (lien) embed.url = lien
    if (notif.description) embed.description = notif.description.slice(0, 300)

    const res = await fetch(webhook, {
      method: 'POST',
      // User-Agent obligatoire : Discord (Cloudflare) renvoie 403/1010 sans lui.
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'alasource-bot/1.0 (+https://alasource.rouge-coquelicot.fr)' },
      body: JSON.stringify({ username: 'À la source', embeds: [embed] }),
    })
    if (!res.ok) {
      console.error(`Discord webhook: reponse ${res.status} pour « ${notif.titre} »`)
    }
  } catch (err) {
    console.error('Discord webhook: echec notification', err)
  }
}
