/**
 * Seed — Sujets amorces (Chantier S, refonte par sujets)
 *
 * Thèmes d'actualité locale qui nous intéressent, façon GroundNews (un sujet
 * agrège veille, couverture et activités). Amorce : le lithium en Alsace et les
 * 7 dossiers locaux Becs Rouges validés (cf. vault, _INDEX - Dossiers locaux).
 *
 * Provenance Becs Rouges tracée (collectif distinct de Rouge Coquelicot). Les
 * accroches reprennent l'angle des dossiers, sans rien inventer.
 *
 * Idempotent (INSERT OR IGNORE sur slug). Usage : npx tsx server/src/db/seed-sujets.ts
 */
import db from '../lib/db.js'

interface SujetSeed {
  slug: string
  titre: string
  accroche: string
  provenance: string
}

const SUJETS: SujetSeed[] = [
  {
    slug: 'lithium-alsace',
    titre: 'Lithium et géothermie en Alsace',
    accroche: "Extraction minière, risques environnementaux, enjeux économiques et démocratiques en Alsace.",
    provenance: 'Becs Rouges / Rouge Coquelicot',
  },
  {
    slug: 'huawei-brumath',
    titre: 'Huawei Brumath',
    accroche: "La promesse industrielle fantôme : usine annoncée en 2020, bâtiments livrés vides à l'automne 2025, production jamais lancée.",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'fermetures-usines-alsace-nord',
    titre: "Fermetures d'usines en Alsace du Nord",
    accroche: "BDR Thermea/De Dietrich, Schaeffler, Duravit, Flabeg, CENPA : la désindustrialisation de l'Alsace du Nord.",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'reme-guichets-haguenau-wissembourg',
    titre: 'REME et guichets, ligne Haguenau-Wissembourg',
    accroche: "La ligne s'améliore (cadence, ponctualité), mais les guichets ferment (Wissembourg, Soultz, Bischwiller, Thann, janvier 2026).",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'gare-haguenau-place-des-services',
    titre: 'Gare de Haguenau, Place des services',
    accroche: "Fermeture du comptoir Place des Services de La Poste en gare, malgré la mobilisation de février 2025.",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'fermetures-classes-bas-rhin',
    titre: 'Fermetures de classes dans le Bas-Rhin',
    accroche: "111 fermetures de classes à la rentrée 2026, dans le sillage de l'austérité budgétaire (PLF 2026).",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'zac-hatten-artificialisation',
    titre: 'ZAC de Hatten, artificialisation',
    accroche: "43,7 ha de terres agricoles pour un parc d'excellence lié à la géothermie et au lithium.",
    provenance: 'Becs Rouges',
  },
  {
    slug: 'zone-loisirs-brumath',
    titre: 'Zone de loisirs de Brumath',
    accroche: "Projet de zone de loisirs (7 ha agricoles) abandonné au stade étude ; vigilance sur le foncier.",
    provenance: 'Becs Rouges',
  },
]

export function seedSujets(): { inserted: number } {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO sujets (slug, titre, accroche, provenance, statut)
    VALUES (@slug, @titre, @accroche, @provenance, 'publie')
  `)
  let inserted = 0
  const tx = db.transaction((rows: SujetSeed[]) => {
    for (const r of rows) {
      const res = stmt.run(r)
      inserted += res.changes
    }
  })
  tx(SUJETS)
  return { inserted }
}

// Exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedSujets()
  console.log(`Seed sujets : ${r.inserted} thème(s) créé(s).`)
}
