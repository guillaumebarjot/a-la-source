/**
 * Migration — Profil de transparence des médias (Chantier B)
 *
 * Remplace l'« indice de confiance » synthétique (verdict bon/mauvais par
 * média, piège Decodex) par un profil de critères factuels et descriptifs,
 * inspiré des critères de NewsGuard mais SANS score global. Chaque critère
 * est un fait vérifiable (0 = non, 1 = oui, NULL = non renseigné), jamais un
 * jugement de valeur. On décrit le mécanisme, on ne note pas.
 *
 * Idempotent. Utilise lib/db (surchargeable par A_LA_SOURCE_DB pour les tests).
 *
 * Usage : npx tsx server/src/db/migrate-media-transparence.ts
 */
import db from '../lib/db.js'

console.log('Migration transparence médias — début')

db.exec(`
  CREATE TABLE IF NOT EXISTS media_transparence (
    media_id INTEGER PRIMARY KEY REFERENCES medias(id) ON DELETE CASCADE,
    distingue_info_opinion INTEGER,
    publie_corrections INTEGER,
    divulgue_propriete INTEGER,
    divulgue_financement INTEGER,
    sans_publicite INTEGER,
    credite_auteurs INTEGER,
    charte_deontologique INTEGER,
    source_observation TEXT,
    maj_le DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)
console.log('  table media_transparence OK')
console.log('Migration transparence médias — terminée')
