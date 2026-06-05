/**
 * Seed — Propriété structurée des médias (Chantier A)
 *
 * Données dérivées des descriptions déjà présentes dans le repo
 * (seed-medias-descriptions.ts) et de connaissances publiques. À VALIDER et
 * compléter par les animateurs à partir de la carte Acrimed / Le Monde
 * diplomatique « Médias français, qui possède quoi ? » (réactualisée le
 * 21/01/2026). Les champs incertains sont laissés vides plutôt qu'inventés.
 *
 * type_propriete : conglomerat | capital_prive | groupe_industriel | public |
 *                  cooperative | associatif | independant | autre
 *
 * Usage : npx tsx server/src/db/seed-medias-propriete.ts
 */
import db from '../lib/db.js'

interface Propriete {
  proprietaire?: string
  actionnaire_ultime?: string
  type_propriete?: string
  financement?: string
  annee_creation?: number
  ligne_revendiquee?: string
}

const DATA: Record<string, Propriete> = {
  'Le Monde': { proprietaire: 'Groupe Le Monde', actionnaire_ultime: 'Xavier Niel, Daniel Křetínský, famille Pigasse', type_propriete: 'capital_prive', financement: 'abonnements + publicité', annee_creation: 1944, ligne_revendiquee: 'centre-gauche' },
  'Le Figaro': { proprietaire: 'Groupe Dassault', actionnaire_ultime: 'Famille Dassault', type_propriete: 'groupe_industriel', financement: 'abonnements + publicité', annee_creation: 1826, ligne_revendiquee: 'conservatrice-libérale' },
  'Liberation': { proprietaire: 'Altice', actionnaire_ultime: 'Patrick Drahi', type_propriete: 'capital_prive', financement: 'abonnements + publicité', annee_creation: 1973, ligne_revendiquee: 'gauche' },
  'Mediapart': { proprietaire: 'Société pour la protection de l’indépendance de Mediapart', actionnaire_ultime: 'Fonds pour une presse libre (but non lucratif)', type_propriete: 'independant', financement: 'abonnements, sans publicité', annee_creation: 2008, ligne_revendiquee: 'investigation indépendante' },
  'BFM TV': { proprietaire: 'Groupe Altice (RMC BFM)', actionnaire_ultime: 'Patrick Drahi', type_propriete: 'capital_prive', financement: 'publicité', annee_creation: 2005, ligne_revendiquee: 'information en continu' },
  'Franceinfo': { proprietaire: 'France Télévisions / Radio France', actionnaire_ultime: 'État (service public)', type_propriete: 'public', financement: 'public', ligne_revendiquee: 'service public' },
  'France Inter': { proprietaire: 'Radio France', actionnaire_ultime: 'État (service public)', type_propriete: 'public', financement: 'public', ligne_revendiquee: 'généraliste service public' },
  'France Culture': { proprietaire: 'Radio France', actionnaire_ultime: 'État (service public)', type_propriete: 'public', financement: 'public', ligne_revendiquee: 'culturelle service public' },
  'Arte': { proprietaire: 'Arte GEIE (franco-allemand)', actionnaire_ultime: 'États français et allemand', type_propriete: 'public', financement: 'public', ligne_revendiquee: 'culturelle service public' },
  "L'Alsace": { proprietaire: 'Groupe EBRA', actionnaire_ultime: 'Crédit Mutuel Alliance Fédérale', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Haut-Rhin)' },
  'DNA': { proprietaire: 'Groupe EBRA', actionnaire_ultime: 'Crédit Mutuel Alliance Fédérale', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Bas-Rhin)' },
  'Le Progres': { proprietaire: 'Groupe EBRA', actionnaire_ultime: 'Crédit Mutuel Alliance Fédérale', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (lyonnaise)' },
  'Le Dauphine libere': { proprietaire: 'Groupe EBRA', actionnaire_ultime: 'Crédit Mutuel Alliance Fédérale', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (sud-est)' },
  'Ouest-France': { proprietaire: 'Groupe SIPA / Ouest-France', actionnaire_ultime: 'Association pour le soutien des principes de la démocratie humaniste', type_propriete: 'associatif', financement: 'ventes + publicité', annee_creation: 1944, ligne_revendiquee: 'démocrate-chrétienne' },
  'Reporterre': { proprietaire: 'Reporterre (association)', actionnaire_ultime: 'association, dons', type_propriete: 'independant', financement: 'dons', annee_creation: 2013, ligne_revendiquee: 'écologie' },
  'Bastamag': { proprietaire: 'Basta! (coopérative)', type_propriete: 'independant', financement: 'dons + abonnements', annee_creation: 2008, ligne_revendiquee: 'social et environnemental' },
  'Basta!': { proprietaire: 'Basta! (coopérative)', type_propriete: 'independant', financement: 'dons + abonnements', annee_creation: 2008, ligne_revendiquee: 'social et environnemental' },
  'Blast': { proprietaire: 'Blast (association)', actionnaire_ultime: 'Denis Robert / dons', type_propriete: 'independant', financement: 'dons', annee_creation: 2021, ligne_revendiquee: 'enquête, gauche' },
  'Le Point': { proprietaire: 'Artémis', actionnaire_ultime: 'François Pinault', type_propriete: 'capital_prive', financement: 'ventes + publicité', annee_creation: 1972, ligne_revendiquee: 'libéral' },
  "L'Opinion": { proprietaire: 'Groupe l’Opinion', actionnaire_ultime: 'Nicolas Beytout (Bernard Arnault parmi les actionnaires)', type_propriete: 'capital_prive', financement: 'publicité + abonnements', annee_creation: 2013, ligne_revendiquee: 'libéral pro-business' },
  'Les Echos': { proprietaire: 'LVMH', actionnaire_ultime: 'Bernard Arnault', type_propriete: 'capital_prive', financement: 'abonnements + publicité', ligne_revendiquee: 'économique et financier' },
  'Alternatives Economiques': { proprietaire: 'Scop Alternatives Économiques', actionnaire_ultime: 'coopérative (salariés)', type_propriete: 'cooperative', financement: 'abonnements', ligne_revendiquee: 'sociale-démocrate' },
  'Le Canard enchaine': { proprietaire: 'Les Éditions Maréchal-Le Canard enchaîné', actionnaire_ultime: 'salariés (autogéré)', type_propriete: 'independant', financement: 'ventes, sans publicité', annee_creation: 1915, ligne_revendiquee: 'satirique et investigation' },
  "L'Humanite": { proprietaire: "Société nouvelle du journal L'Humanité", actionnaire_ultime: 'société des lecteurs, proche PCF', type_propriete: 'independant', financement: 'ventes + dons', annee_creation: 1904, ligne_revendiquee: 'gauche sociale' },
  'La Croix': { proprietaire: 'Groupe Bayard', actionnaire_ultime: 'Augustins de l’Assomption (congrégation)', type_propriete: 'associatif', financement: 'abonnements', annee_creation: 1883, ligne_revendiquee: 'sociale-chrétienne' },
  'Le Monde diplomatique': { proprietaire: 'Le Monde diplomatique SA (Le Monde + Amis du Monde diplomatique + association Gunter Holzmann)', type_propriete: 'independant', financement: 'abonnements', ligne_revendiquee: 'altermondialiste' },
  'Politis': { proprietaire: 'Politis (coopérative)', actionnaire_ultime: 'coopérative, lecteurs', type_propriete: 'cooperative', financement: 'abonnements + dons', annee_creation: 1988, ligne_revendiquee: 'écologie politique' },
  'Marianne': { type_propriete: 'capital_prive', financement: 'ventes + publicité', annee_creation: 1997, ligne_revendiquee: 'souverainiste de gauche' },
  'LCI': { proprietaire: 'Groupe TF1 (Bouygues)', actionnaire_ultime: 'Groupe Bouygues', type_propriete: 'groupe_industriel', financement: 'publicité', ligne_revendiquee: 'information en continu' },
  'CNews': { proprietaire: 'Canal+ / Vivendi', actionnaire_ultime: 'Vincent Bolloré', type_propriete: 'capital_prive', financement: 'publicité', ligne_revendiquee: 'très à droite' },
  'RMC': { proprietaire: 'Groupe Altice', actionnaire_ultime: 'Patrick Drahi', type_propriete: 'capital_prive', financement: 'publicité', ligne_revendiquee: 'généraliste, talk' },
  'Europe 1': { proprietaire: 'Lagardère / Vivendi', actionnaire_ultime: 'Vincent Bolloré', type_propriete: 'capital_prive', financement: 'publicité', ligne_revendiquee: 'conservatrice' },
  'RTL': { proprietaire: 'Groupe M6 / RTL Group', actionnaire_ultime: 'Bertelsmann', type_propriete: 'groupe_industriel', financement: 'publicité', ligne_revendiquee: 'généraliste' },
  'Sud Ouest': { proprietaire: 'Groupe Sud Ouest', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Nouvelle-Aquitaine)' },
  'La Depeche du Midi': { proprietaire: 'Groupe La Dépêche', actionnaire_ultime: 'famille Baylet', type_propriete: 'capital_prive', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Occitanie)' },
  'Le Telegramme': { proprietaire: 'Groupe Télégramme', type_propriete: 'independant', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Bretagne)' },
  'La Voix du Nord': { proprietaire: 'Groupe Rossel', type_propriete: 'groupe_industriel', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Hauts-de-France)' },
  'Nice-Matin': { proprietaire: 'Groupe Nice-Matin', type_propriete: 'autre', financement: 'ventes + publicité', ligne_revendiquee: 'régionale (Alpes-Maritimes, Var)' },
  'Rue89': { proprietaire: "L'Obs", type_propriete: 'capital_prive', financement: 'publicité', annee_creation: 2007, ligne_revendiquee: 'pure player, déclinaisons locales' },
  'Les Jours': { proprietaire: 'Les Jours (société de journalistes)', type_propriete: 'independant', financement: 'abonnements', annee_creation: 2016, ligne_revendiquee: 'enquête au long cours' },
  'Arrêt sur images': { proprietaire: 'Arrêt sur images (indépendant)', actionnaire_ultime: 'Daniel Schneidermann / abonnés', type_propriete: 'independant', financement: 'abonnements', annee_creation: 2007, ligne_revendiquee: 'critique des médias' },
  'Mr Mondialisation': { proprietaire: 'Mr Mondialisation (association)', type_propriete: 'independant', financement: 'dons', ligne_revendiquee: 'écologie, alternatives' },
  'Bon Pote': { proprietaire: 'Bon Pote', actionnaire_ultime: 'Thomas Wagner', type_propriete: 'independant', financement: 'abonnements + dons', ligne_revendiquee: 'climat, vulgarisation' },
  'Vert': { proprietaire: 'Vert (association)', type_propriete: 'independant', financement: 'dons', annee_creation: 2020, ligne_revendiquee: 'écologie, accessible' },
}

const stmt = db.prepare(`
  UPDATE medias SET
    proprietaire = COALESCE(@proprietaire, proprietaire),
    actionnaire_ultime = COALESCE(@actionnaire_ultime, actionnaire_ultime),
    type_propriete = COALESCE(@type_propriete, type_propriete),
    financement = COALESCE(@financement, financement),
    annee_creation = COALESCE(@annee_creation, annee_creation),
    ligne_revendiquee = COALESCE(@ligne_revendiquee, ligne_revendiquee)
  WHERE nom = @nom COLLATE NOCASE
`)

const run = db.transaction(() => {
  let updated = 0, absents = 0
  for (const [nom, p] of Object.entries(DATA)) {
    const res = stmt.run({
      nom,
      proprietaire: p.proprietaire ?? null,
      actionnaire_ultime: p.actionnaire_ultime ?? null,
      type_propriete: p.type_propriete ?? null,
      financement: p.financement ?? null,
      annee_creation: p.annee_creation ?? null,
      ligne_revendiquee: p.ligne_revendiquee ?? null,
    })
    if (res.changes > 0) updated++
    else absents++
  }
  return { updated, absents }
})

const { updated, absents } = run()
console.log(`Seed propriété médias — ${updated} média(s) mis à jour, ${absents} non trouvé(s) dans la base.`)
