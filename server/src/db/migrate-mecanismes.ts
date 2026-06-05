/**
 * Migration — Enrichissement des mecanismes (10 → 25+)
 * Ajout categories, sources_reference, et nouveaux mecanismes
 * Ajout evaluations.sourcing (la source est-elle correctement sourcee ?)
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Migration mecanismes enrichis — debut')

// Ajouter colonnes a mecanismes_reference
const mecaCols = (db.prepare("PRAGMA table_info(mecanismes_reference)").all() as { name: string }[]).map(c => c.name)

if (!mecaCols.includes('categorie')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN categorie TEXT DEFAULT 'manipulation';`)
  console.log('  + mecanismes_reference.categorie')
}
if (!mecaCols.includes('sources_reference')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN sources_reference TEXT;`)
  console.log('  + mecanismes_reference.sources_reference')
}

// Ajouter evaluations.sourcing
const evalCols = (db.prepare("PRAGMA table_info(evaluations)").all() as { name: string }[]).map(c => c.name)
if (!evalCols.includes('sourcing')) {
  db.exec(`ALTER TABLE evaluations ADD COLUMN sourcing INTEGER DEFAULT 0 CHECK(sourcing BETWEEN 0 AND 10);`)
  console.log('  + evaluations.sourcing (qualite du sourcing de la ressource)')
}

// Mettre a jour les 10 mecanismes existants avec categories et sources
const updateMeca = db.prepare(`
  UPDATE mecanismes_reference SET categorie = ?, sources_reference = ?, questions_guidees = ?
  WHERE nom = ?
`)

// Categoriser les existants
updateMeca.run('cadrage', 'Kahneman & Tversky, 1981 — "The Framing of Decisions". Chomsky & Herman, 1988 — "Manufacturing Consent".', '["Quel angle a ete choisi ?","Quels autres angles etaient possibles ?","Qui parle en premier, qui a le dernier mot ?","Quels mots sont employes (reforme vs recul, charges vs cotisations) ?"]', 'Effet de cadrage')
updateMeca.run('manipulation_chiffres', 'Gerd Gigerenzer, 2002 — "Calculated Risks". ACRIMED — "Comment les chiffres mentent".', '["Ce chiffre est-il contextualise ?","Quelle impression donne-t-il tel quel ?","Que faudrait-il savoir de plus ?","Qui a produit ce chiffre, dans quel but ?"]', 'Chiffre-paravent')
updateMeca.run('argumentation', 'Schopenhauer — "L\'art d\'avoir toujours raison". Breton, 1996 — "L\'argumentation dans la communication".', '["L\'expert·e cite·e est-il·elle competent·e sur ce sujet precis ?","Son avis represente-t-il un consensus ?","L\'argument est-il c\'est vrai parce que X le dit ?"]', "Argument d'autorite")
updateMeca.run('manipulation_emotion', 'Damasio, 1994 — "L\'erreur de Descartes". Rimé, 2005 — "Le partage social des emotions".', '["Quelle emotion cette source provoque-t-elle ?","Cette emotion aide-t-elle a comprendre ou empeche-t-elle de reflechir ?","Pourrait-on traiter le sujet sans cette charge emotionnelle ?"]', "Appel a l'emotion")
updateMeca.run('argumentation', 'Baillargeon, 2005 — "Petit cours d\'autodefense intellectuelle".', '["Quelles sont les deux options presentees ?","Quelles alternatives sont invisibilisees ?","Pourquoi cette binarite arrange-t-elle quelqu\'un ?"]', 'Faux dilemme')
updateMeca.run('selection_info', 'Chomsky & Herman, 1988 — "Manufacturing Consent" (filtres). Berthaut, 2013 — "La banlieue du 20h".', '["Les faits presentes sont-ils representatifs ?","Quels faits manquent a ce tableau ?","La these tiendrait-elle avec l\'ensemble des donnees ?"]', 'Cherry-picking')
updateMeca.run('argumentation', 'Baillargeon, 2005. Schopenhauer — "L\'art d\'avoir toujours raison", stratageme 23.', '["De combien de cas parle-t-on ?","Peut-on generaliser a partir de ce nombre ?","Quelles donnees statistiques existent ?"]', 'Generalisation abusive')
updateMeca.run('argumentation', 'Schopenhauer — stratageme 1. Baillargeon, 2005.', '["La position adverse est-elle presentee fidelement ?","Que diraient les personnes critiquees ?","La refutation attaque-t-elle l\'argument reel ou une caricature ?"]', 'Homme de paille')
updateMeca.run('argumentation', 'Baillargeon, 2005. Tindale, 2007 — "Fallacies and Argument Appraisal".', '["Quelles sont les etapes de l\'enchainement ?","Chaque etape decoule-t-elle de la precedente ?","La conclusion est-elle realiste ?"]', 'Pente glissante')
updateMeca.run('equilibre_editorial', 'Boykoff & Boykoff, 2004 — "Balance as Bias". IPCC guidelines on communicating certainty.', '["Les deux positions ont-elles le meme poids factuel ?","L\'equilibre editorial reflete-t-il la realite du debat ?","Qui beneficie de cette mise en equivalence ?"]', 'Fausse equivalence')

// Ajouter les nouveaux mecanismes
const insertMeca = db.prepare(`
  INSERT OR IGNORE INTO mecanismes_reference (nom, description, exemple, questions_guidees, categorie, sources_reference)
  VALUES (?, ?, ?, ?, ?, ?)
`)

// --- Cadrage et selection ---
insertMeca.run(
  'Omission',
  "Ne pas mentionner une information pertinente qui changerait la comprehension du sujet. L'absence d'information est aussi un choix editorial.",
  "Un article sur la hausse du chomage qui ne mentionne pas les radiations massives de Pole emploi la meme semaine.",
  '["Quelles informations manquent ?","Le sujet est-il traite dans son integralite ?","Qui est absent du recit ?"]',
  'selection_info',
  'Herman & Chomsky, 1988. Bourdieu, 1996 — "Sur la television".'
)

insertMeca.run(
  'Inversion de la charge de la preuve',
  "Demander a celui qui subit de prouver qu'il a raison, plutot qu'a celui qui affirme de prouver ses dires.",
  "\"Prouvez que ce pesticide est dangereux\" au lieu de \"Prouvez qu'il est inoffensif avant de le commercialiser\".",
  '["Qui doit prouver quoi ?","La charge de la preuve est-elle correctement attribuee ?","Cette inversion profite-t-elle a quelqu\'un ?"]',
  'argumentation',
  'Baillargeon, 2005. Karl Popper — "La logique de la decouverte scientifique".'
)

insertMeca.run(
  'Naturalisation',
  "Presenter un fait social ou politique comme naturel, inevitable, ou relevant du bon sens, masquant ainsi qu'il resulte de choix humains.",
  "\"C'est la loi du marche\" — comme si le marche etait un phenomene naturel et non une construction sociale avec des regles modifiables.",
  '["Ce qui est presente comme naturel est-il vraiment inevitable ?","Qui a decide ces regles ?","Pourrait-on faire autrement ?"]',
  'cadrage',
  'Bourdieu, 1977 — "La production de la croyance". Barthes, 1957 — "Mythologies".'
)

insertMeca.run(
  'Euphemisme',
  "Utiliser un vocabulaire adouci pour masquer la violence ou la gravite d'une situation.",
  "\"Plan de sauvegarde de l'emploi\" pour un licenciement massif. \"Frappe chirurgicale\" pour un bombardement.",
  '["Les mots utilises refletent-ils la realite ?","Quel vocabulaire alternatif serait plus precis ?","L\'euphemisme masque-t-il une violence ?"]',
  'cadrage',
  'Hazan, 2006 — "LQR : La propagande du quotidien". Klemperer, 1947 — "LTI".'
)

insertMeca.run(
  'Amalgame',
  "Mettre dans le meme sac des elements distincts pour transferer les proprietes negatives de l'un a l'autre.",
  "Associer systematiquement immigration et insecurite dans un meme sujet, creant un lien implicite sans le demontrer.",
  '["Les elements associes sont-ils reellement lies ?","L\'association est-elle demontree ou suggeree ?","Qui profite de cet amalgame ?"]',
  'argumentation',
  'Breton, 1996 — "L\'argumentation dans la communication". ACRIMED, divers articles.'
)

insertMeca.run(
  'Personnalisation',
  "Reduire un enjeu collectif ou structurel a une personne (hero ou bouc emissaire), empechant l'analyse systemique.",
  "Attribuer la crise economique a un·e seul·e dirigeant·e plutot qu'a des mecanismes structurels.",
  '["Le sujet est-il reduit a une personne ?","Quels sont les facteurs structurels invisibilises ?","La personnalisation simplifie-t-elle abusivement ?"]',
  'cadrage',
  'Bourdieu, 1996 — "Sur la television". Halimi, 2005 — "Les nouveaux chiens de garde".'
)

insertMeca.run(
  'Faux consensus',
  "Presenter une opinion minoritaire ou contestee comme largement partagee, ou inversement minimiser un consensus reel.",
  "\"Tout le monde sait que...\" pour une opinion controversee. \"Le debat est loin d'etre tranche\" sur le rechauffement climatique.",
  '["Ce consensus existe-t-il vraiment ?","Quelles sont les positions divergentes ?","Des donnees confirment-elles ce consensus ?"]',
  'argumentation',
  'Oreskes & Conway, 2010 — "Merchants of Doubt". Cook et al., 2013 — Scientific consensus.'
)

insertMeca.run(
  'Whataboutisme',
  "Repondre a une critique en pointant un probleme ailleurs, sans repondre sur le fond.",
  "\"Oui mais les autres pays polluent aussi\" en reponse a une critique sur les emissions nationales.",
  '["La reponse porte-t-elle sur le sujet initial ?","Le detournement est-il justifie ?","La critique initiale reste-t-elle sans reponse ?"]',
  'argumentation',
  'Pratique documentee pendant la Guerre froide (propagande sovietique). Voir aussi "tu quoque".'
)

insertMeca.run(
  'Appel a la tradition',
  "Justifier une pratique par son anciennete plutot que par sa pertinence actuelle.",
  "\"On a toujours fait comme ca\" comme argument contre une reforme.",
  '["L\'anciennete est-elle un argument valide ici ?","Les conditions ont-elles change ?","La tradition justifie-t-elle l\'immobilisme ?"]',
  'argumentation',
  'Baillargeon, 2005 — sophisme ad antiquitatem.'
)

insertMeca.run(
  'Decontextualisation',
  "Extraire une citation, un fait ou un chiffre de son contexte pour lui faire dire autre chose que son sens original.",
  "Citer une phrase d'un rapport en ignorant la nuance qui suit immediatement.",
  '["La citation est-elle complete ?","Quel est le contexte original ?","Le sens change-t-il avec le contexte ?"]',
  'manipulation_chiffres',
  'Van Dijk, 1988 — "News as Discourse". Charaudeau, 2005 — "Les medias et l\'information".'
)

insertMeca.run(
  'Effet de repetition',
  "Repeter une affirmation suffisamment souvent pour qu'elle soit tenue pour vraie, independamment des preuves.",
  "Un chiffre faux repris par tous les medias sans verification pendant plusieurs jours.",
  '["Cette affirmation est-elle sourcee a l\'origine ?","La repetition tient-elle lieu de preuve ?","Qui a lance cette information ?"]',
  'manipulation_emotion',
  'Illusory truth effect — Hasher, Goldstein & Toppino, 1977. Goebbels (usage historique).'
)

insertMeca.run(
  'Biais de survie',
  "Ne montrer que les cas qui ont \"reussi\" en ignorant tous ceux qui ont echoue, donnant une image faussee de la realite.",
  "Interviewer des entrepreneur·ses a succes pour prouver que \"quand on veut on peut\", en ignorant les 90% qui echouent.",
  '["Ne voit-on que les cas qui confirment la these ?","Ou sont les contre-exemples ?","L\'echantillon est-il biaise vers le succes ?"]',
  'selection_info',
  'Wald, 1943 (origine militaire). Taleb, 2007 — "The Black Swan".'
)

insertMeca.run(
  'Fausse causalite',
  "Presenter deux evenements correles comme ayant un lien de cause a effet, sans le demontrer (post hoc ergo propter hoc).",
  "\"Depuis qu'on a installe des cameras, la delinquance a baisse\" — sans considerer les autres facteurs.",
  '["La correlation implique-t-elle une causalite ?","D\'autres facteurs pourraient-ils expliquer le lien ?","L\'ordre chronologique suffit-il a prouver la cause ?"]',
  'argumentation',
  'Hume, 1748 — "Enquete sur l\'entendement humain". Pearl, 2000 — "Causality".'
)

insertMeca.run(
  'Fenetre d\'Overton',
  "Deplacer progressivement les limites du debat acceptable en introduisant des positions extremes, rendant les positions auparavant inacceptables plus moderees par comparaison.",
  "Proposer l'expulsion de tous les etrangers pour rendre acceptable la suppression du droit d'asile, qui semble alors \"moderee\".",
  '["Le spectre du debat a-t-il ete elargi artificiellement ?","Les positions extremes rendent-elles d\'autres positions plus acceptables ?","Qui profite de ce deplacement ?"]',
  'cadrage',
  'Overton, années 2000 (Mackinac Center). Chomsky — "The Common Good".'
)

insertMeca.run(
  'Appel a la peur',
  "Utiliser la peur comme levier pour faire accepter une mesure, un produit ou une idee, en exagerant un danger.",
  "\"Sans cette loi, le terrorisme frappera demain\" — pour justifier une restriction des libertes.",
  '["La peur exprimee est-elle proportionnee au risque reel ?","La mesure proposee repond-elle vraiment a la menace ?","Qui beneficie de cette peur ?"]',
  'manipulation_emotion',
  'Glassner, 1999 — "The Culture of Fear". Furedi, 2005 — "Politics of Fear".'
)

console.log('Migration mecanismes enrichis — terminee')
console.log(`  ${(db.prepare('SELECT COUNT(*) as n FROM mecanismes_reference').get() as { n: number } | undefined)?.n || 0} mecanismes en base`)
db.close()
