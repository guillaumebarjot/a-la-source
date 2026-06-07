/**
 * Seed : ajouter les medias manquants dans la base.
 * Couvre la presse nationale, PQR, pure players, radio/TV, institutionnel, associatif.
 * Ignore les doublons (INSERT OR IGNORE avec UNIQUE sur nom).
 */
import Database from 'better-sqlite3'
import { DB_PATH } from './dbPath.js'

// Base UNIQUE et canonique (OneDrive) via dbPath. Seed idempotent (INSERT OR IGNORE).
const db = new Database(DB_PATH)

interface MediaEntry {
  nom: string
  type: string
  url_site?: string
}

const MEDIAS: MediaEntry[] = [
  // -- Presse nationale --
  { nom: 'Le Monde', type: 'presse', url_site: 'https://www.lemonde.fr' },
  { nom: 'Le Figaro', type: 'presse', url_site: 'https://www.lefigaro.fr' },
  { nom: 'Liberation', type: 'presse', url_site: 'https://www.liberation.fr' },
  { nom: 'Mediapart', type: 'presse', url_site: 'https://www.mediapart.fr' },
  { nom: "L'Humanite", type: 'presse', url_site: 'https://www.humanite.fr' },
  { nom: 'Le Point', type: 'presse', url_site: 'https://www.lepoint.fr' },
  { nom: "L'Opinion", type: 'presse', url_site: 'https://www.lopinion.fr' },
  { nom: "L'Obs", type: 'presse', url_site: 'https://www.nouvelobs.com' },
  { nom: "L'Express", type: 'presse', url_site: 'https://www.lexpress.fr' },
  { nom: 'Marianne', type: 'presse', url_site: 'https://www.marianne.net' },
  { nom: 'Challenges', type: 'presse', url_site: 'https://www.challenges.fr' },
  { nom: 'Le Parisien', type: 'presse', url_site: 'https://www.leparisien.fr' },
  { nom: 'Les Echos', type: 'presse', url_site: 'https://www.lesechos.fr' },
  { nom: 'La Tribune', type: 'presse', url_site: 'https://www.latribune.fr' },
  { nom: 'Courrier International', type: 'presse', url_site: 'https://www.courrierinternational.com' },
  { nom: 'Le JDD', type: 'presse', url_site: 'https://www.lejdd.fr' },
  { nom: 'Le Canard Enchaine', type: 'presse', url_site: 'https://www.lecanardenchaine.fr' },

  // -- Hebdos / magazines --
  { nom: 'Telerama', type: 'presse', url_site: 'https://www.telerama.fr' },
  { nom: 'Alternatives Economiques', type: 'presse', url_site: 'https://www.alternatives-economiques.fr' },
  { nom: 'Politis', type: 'presse', url_site: 'https://www.politis.fr' },

  // -- Pure players --
  { nom: 'Reporterre', type: 'web', url_site: 'https://reporterre.net' },
  { nom: 'Bastamag', type: 'web', url_site: 'https://basta.media' },
  { nom: 'Blast', type: 'web', url_site: 'https://www.blast-info.fr' },
  { nom: 'Disclose', type: 'web', url_site: 'https://disclose.ngo' },
  { nom: 'StreetPress', type: 'web', url_site: 'https://www.streetpress.com' },
  { nom: 'Reflets.info', type: 'web', url_site: 'https://reflets.info' },
  { nom: 'Les Jours', type: 'web', url_site: 'https://lesjours.fr' },
  { nom: "Arret sur images", type: 'web', url_site: 'https://www.arretsurimages.net' },
  { nom: 'Le Media TV', type: 'web', url_site: 'https://www.lemediatv.fr' },
  { nom: 'Vert.eco', type: 'web', url_site: 'https://vert.eco' },
  { nom: 'Rue89 Strasbourg', type: 'web', url_site: 'https://www.rue89strasbourg.com' },

  // -- Radio / TV --
  { nom: 'Franceinfo', type: 'tv', url_site: 'https://www.francetvinfo.fr' },
  { nom: 'France Inter', type: 'radio', url_site: 'https://www.radiofrance.fr/franceinter' },
  { nom: 'France Culture', type: 'radio', url_site: 'https://www.radiofrance.fr/franceculture' },
  { nom: 'BFM TV', type: 'tv', url_site: 'https://www.bfmtv.com' },
  { nom: 'TF1 Info', type: 'tv', url_site: 'https://www.tf1info.fr' },
  { nom: 'Arte', type: 'tv', url_site: 'https://www.arte.tv' },
  { nom: 'RFI', type: 'radio', url_site: 'https://www.rfi.fr' },
  { nom: 'France 24', type: 'tv', url_site: 'https://www.france24.com' },
  { nom: 'Europe 1', type: 'radio', url_site: 'https://www.europe1.fr' },
  { nom: 'LCP', type: 'tv', url_site: 'https://www.lcp.fr' },

  // -- PQR --
  { nom: "L'Alsace", type: 'PQR', url_site: 'https://www.lalsace.fr' },
  { nom: 'DNA', type: 'PQR', url_site: 'https://www.dna.fr' },
  { nom: 'Est Republicain', type: 'PQR', url_site: 'https://www.estrepublicain.fr' },
  { nom: 'Le Progres', type: 'PQR', url_site: 'https://www.leprogres.fr' },
  { nom: 'Le Dauphine Libere', type: 'PQR', url_site: 'https://www.ledauphine.com' },
  { nom: 'La Depeche', type: 'PQR', url_site: 'https://www.ladepeche.fr' },
  { nom: 'Sud Ouest', type: 'PQR', url_site: 'https://www.sudouest.fr' },
  { nom: 'La Voix du Nord', type: 'PQR', url_site: 'https://www.lavoixdunord.fr' },
  { nom: 'Ouest-France', type: 'PQR', url_site: 'https://www.ouest-france.fr' },
  { nom: 'Le Telegramme', type: 'PQR', url_site: 'https://www.letelegramme.fr' },
  { nom: 'Midi Libre', type: 'PQR', url_site: 'https://www.midilibre.fr' },
  { nom: 'Nice-Matin', type: 'PQR', url_site: 'https://www.nicematin.com' },
  { nom: 'La Marseillaise', type: 'PQR', url_site: 'https://www.lamarseillaise.fr' },
  { nom: 'Courrier Picard', type: 'PQR', url_site: 'https://www.courrier-picard.fr' },
  { nom: 'Actu.fr', type: 'PQR', url_site: 'https://actu.fr' },
  { nom: '20 Minutes', type: 'presse', url_site: 'https://www.20minutes.fr' },
  { nom: 'Republicain Lorrain', type: 'PQR', url_site: 'https://www.republicain-lorrain.fr' },

  // -- Institutionnel --
  { nom: 'Vie publique', type: 'institutionnel', url_site: 'https://www.vie-publique.fr' },
  { nom: 'Senat', type: 'institutionnel', url_site: 'https://www.senat.fr' },
  { nom: 'Assemblee nationale', type: 'institutionnel', url_site: 'https://www.assemblee-nationale.fr' },
  { nom: 'Legifrance', type: 'institutionnel', url_site: 'https://www.legifrance.gouv.fr' },
  { nom: 'INSEE', type: 'institutionnel', url_site: 'https://www.insee.fr' },
  { nom: 'IRDES', type: 'institutionnel', url_site: 'https://www.irdes.fr' },

  // -- Associatif / ONG --
  { nom: 'Oxfam France', type: 'associatif', url_site: 'https://www.oxfamfrance.org' },
  { nom: 'Amnesty International France', type: 'associatif', url_site: 'https://www.amnesty.fr' },
  { nom: 'Greenpeace France', type: 'associatif', url_site: 'https://www.greenpeace.fr' },
  { nom: 'Attac', type: 'associatif', url_site: 'https://www.attac.org' },

  // -- Sciences / fact-checking --
  { nom: 'The Conversation', type: 'web', url_site: 'https://theconversation.com/fr' },
  { nom: 'AFP', type: 'presse', url_site: 'https://www.afp.com' },
]

export function seedMedias() {
  // Ensure url_site column exists
  try {
    db.prepare('SELECT url_site FROM medias LIMIT 1').get()
  } catch {
    db.prepare('ALTER TABLE medias ADD COLUMN url_site TEXT').run()
    console.log('Colonne url_site ajoutee a la table medias')
  }

  // Ensure type column exists
  try {
    db.prepare('SELECT type FROM medias LIMIT 1').get()
  } catch {
    db.prepare('ALTER TABLE medias ADD COLUMN type TEXT').run()
    console.log('Colonne type ajoutee a la table medias')
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO medias (nom, type, url_site) VALUES (?, ?, ?)
  `)
  const updateUrl = db.prepare(`
    UPDATE medias SET url_site = ? WHERE nom = ? AND (url_site IS NULL OR url_site = '')
  `)
  const updateType = db.prepare(`
    UPDATE medias SET type = ? WHERE nom = ? AND (type IS NULL OR type = '')
  `)

  let inserted = 0
  let updated = 0

  const tx = db.transaction(() => {
    for (const m of MEDIAS) {
      const r = insert.run(m.nom, m.type, m.url_site || null)
      if (r.changes > 0) {
        inserted++
      } else {
        // Existing entry — update url_site and type if missing
        if (m.url_site) {
          const r2 = updateUrl.run(m.url_site, m.nom)
          if (r2.changes > 0) updated++
        }
        if (m.type) {
          const r3 = updateType.run(m.type, m.nom)
          if (r3.changes > 0) updated++
        }
      }
    }
  })
  tx()

  console.log(`Seed medias: ${inserted} inseres, ${updated} mis a jour (sur ${MEDIAS.length} entrees)`)
  db.close()
}

// Auto-run
seedMedias()
