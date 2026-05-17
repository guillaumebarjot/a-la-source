/**
 * Met a jour les descriptions des principaux medias dans la base.
 * Usage : npx tsx server/src/db/seed-medias-descriptions.ts
 */
import db from '../lib/db.js'

const descriptions: Record<string, string> = {
  'Le Monde': "Quotidien national de reference, fonde en 1944. Ligne editoriale centre-gauche. Propriete du groupe Le Monde (Xavier Niel, Matthieu Pigasse, Daniel Kretinsky).",
  'Le Figaro': "Plus ancien quotidien francais (1826). Ligne conservatrice-liberale. Propriete du groupe Dassault.",
  'Liberation': "Quotidien fonde en 1973 par Jean-Paul Sartre. Ligne de gauche. Propriete du groupe Altice (Patrick Drahi).",
  'Mediapart': "Pure player d'investigation fonde en 2008 par Edwy Plenel. Independant, finance par les abonnements. Pas de publicite.",
  'BFM TV': "Chaine d'information en continu (2005). Propriete du groupe Altice (Patrick Drahi). Critiquee pour le traitement sensationnaliste.",
  'Franceinfo': "Service public d'information (radio + TV + web). France Televisions / Radio France.",
  'France Inter': "Radio publique generaliste (Radio France). Interviews politiques matinales, magazines culturels.",
  'France Culture': "Radio publique culturelle et intellectuelle (Radio France). Debats, documentaires, podcasts.",
  "L'Alsace": "Quotidien regional alsacien. Groupe EBRA (Credit Mutuel). Couvre le Haut-Rhin principalement.",
  'DNA': "Dernieres Nouvelles d'Alsace. Groupe EBRA. Couvre le Bas-Rhin et Strasbourg.",
  'Ouest-France': "Premier quotidien francais par le tirage. Couvre le Grand Ouest. Ligne democrate-chretienne.",
  'Reporterre': "Media independant specialise en ecologie. Fonde par Herve Kempf. Finance par les dons.",
  'Bastamag': "Media independant d'investigation sociale et environnementale. Fonde en 2008.",
  'Blast': "Media independant fonde par Denis Robert (2021). Enquetes et debats. Finance par les dons.",
  'Le Point': "Newsmagazine liberal fonde en 1972. Propriete de Francois Pinault (Artemis).",
  "L'Opinion": "Quotidien liberal et pro-business fonde en 2013. Propriete de Bernard Arnault (LVMH).",
  'Alternatives Economiques': "Mensuel cooperatif d'information economique et sociale. Ligne sociale-democrate.",
  'Les Echos': "Quotidien economique et financier. Propriete du groupe LVMH (Bernard Arnault).",
  'Le Canard enchaine': "Hebdomadaire satirique et d'investigation fonde en 1915. Independant, sans publicite, autogere par ses salaries.",
  'L\'Humanite': "Quotidien fonde par Jean Jaures en 1904. Proche du PCF historiquement, ligne de gauche sociale.",
  'La Croix': "Quotidien catholique fonde en 1883. Groupe Bayard. Ligne sociale-chretienne.",
  'Le Monde diplomatique': "Mensuel d'analyse internationale et geopolitique. Ligne altermondialiste. Independant editorially du Monde.",
  'Politis': "Hebdomadaire ecologiste et social fonde en 1988. Cooperatif, ligne ecologie politique.",
  'Marianne': "Newsmagazine republicain fonde en 1997. Ligne souverainiste de gauche.",
  'LCI': "Chaine d'information en continu (TF1). Propriete du groupe Bouygues.",
  'CNews': "Chaine d'information en continu. Propriete du groupe Vivendi (Vincent Bollore). Ligne editoriale tres a droite.",
  'Arte': "Chaine culturelle franco-allemande. Service public. Documentaires, reportages, creation.",
  'RMC': "Radio generaliste privee. Groupe Altice (Patrick Drahi). Talk-shows, sport, opinion.",
  'Europe 1': "Radio generaliste privee. Groupe Lagardere puis Vivendi (Bollore). Ligne conservatrice.",
  'RTL': "Radio generaliste privee. Groupe M6 / RTL Group (Bertelsmann). Premiere radio de France en audience.",
  'Sud Ouest': "Quotidien regional. Couvre la Nouvelle-Aquitaine. Groupe Sud Ouest.",
  'La Depeche du Midi': "Quotidien regional. Couvre l'Occitanie. Propriete de la famille Baylet.",
  'Le Telegramme': "Quotidien regional breton. Independant. Couvre la Bretagne ouest.",
  'La Voix du Nord': "Quotidien regional. Groupe Rossel. Couvre les Hauts-de-France.",
  'Le Progres': "Quotidien regional. Groupe EBRA (Credit Mutuel). Couvre la region lyonnaise.",
  'Le Dauphine libere': "Quotidien regional. Groupe EBRA. Couvre Rhone-Alpes et le sud-est.",
  'Nice-Matin': "Quotidien regional. Groupe Nice-Matin. Couvre les Alpes-Maritimes et le Var.",
  'Rue89': "Pure player fonde en 2007, integre a L'Obs en 2011. Declinaisons locales (Rue89 Strasbourg, Lyon).",
  'Les Jours': "Pure player narratif fonde en 2016 par d'anciens de Liberation. Enquetes au long cours, format feuilleton.",
  'Arrêt sur images': "Site d'analyse des medias fonde par Daniel Schneidermann (2007). Decryptage critique du traitement mediatique.",
  'Basta!': "Media independant d'investigation sociale et environnementale. Fonde en 2008. Finance par les dons et abonnements.",
  'Mr Mondialisation': "Media web participatif. Ecologie, alternatives, decroissance. Finance par les dons.",
  'Bon Pote': "Media web specialise climat et environnement. Fonde par Thomas Wagner. Vulgarisation scientifique.",
  'Vert': "Media web dedie a l'ecologie. Fonde en 2020. Newsletter quotidienne, ton accessible.",
}

const stmt = db.prepare('UPDATE medias SET description = ? WHERE nom = ? COLLATE NOCASE')

const updateMany = db.transaction(() => {
  let updated = 0
  for (const [nom, description] of Object.entries(descriptions)) {
    const result = stmt.run(description, nom)
    if (result.changes > 0) updated++
  }
  return updated
})

const count = updateMany()
console.log(`${count} descriptions mises a jour sur ${Object.keys(descriptions).length} definies.`)
