import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Apply schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
db.exec(schema)

// Seed mecanismes
const mecanismes = [
  { nom: 'Chiffre-paravent', description: 'Un chiffre spectaculaire est mis en avant pour detourner l\'attention du fond du sujet ou masquer une realite plus complexe.', exemple: '« 95 % des Francais satisfaits » — sondage commande par l\'entreprise elle-meme, echantillon non representatif.', questions: '["Un chiffre est-il mis en avant des le titre ou le chapeau ?","La source du chiffre est-elle citee et verifiable ?","Le chiffre detourne-t-il l\'attention d\'un aspect plus important ?","La methodologie est-elle expliquee ?"]' },
  { nom: 'Titre-appat', description: 'Le titre ne correspond pas au contenu de l\'article ou en deforme le propos pour attirer le clic.', exemple: '« Ce que les medecins vous cachent sur le cafe » — l\'article dit simplement que le cafe a des effets variables.', questions: '["Le titre correspond-il fidelement au contenu ?","Le titre joue-t-il sur la peur, la curiosite ou l\'indignation ?","Y a-t-il une promesse dans le titre que l\'article ne tient pas ?","Le titre utilise-t-il des superlatifs ou un vocabulaire sensationnaliste ?"]' },
  { nom: 'Argument d\'autorite', description: 'Une affirmation est presentee comme vraie parce qu\'une personne prestigieuse ou titree la soutient, sans que son expertise soit pertinente pour le sujet.', exemple: 'Un prix Nobel de physique cite comme reference sur un sujet de politique economique.', questions: '["Qui parle dans l\'article (expert, elu, anonyme, celebrite) ?","La personne citee est-elle competente sur ce sujet precis ?","Son titre ou sa notoriete est-il utilise comme preuve en soi ?","D\'autres sources ou donnees viennent-elles appuyer le propos ?"]' },
  { nom: 'Correlation = causalite', description: 'Deux phenomenes correles sont presentes comme ayant un lien de cause a effet, sans que ce lien soit demontre.', exemple: '« Les pays qui mangent le plus de chocolat ont le plus de prix Nobel » — correlation sans causalite.', questions: '["L\'article affirme-t-il qu\'un phenomene cause l\'autre ?","Existe-t-il d\'autres facteurs explicatifs possibles ?","La temporalite est-elle respectee (la cause precede l\'effet) ?","Une etude interventionnelle a-t-elle ete menee ?"]' },
  { nom: 'Performativite de l\'indicateur', description: 'Un indicateur cense mesurer une realite finit par modifier les comportements au point de ne plus rien mesurer fidelement (loi de Goodhart).', exemple: 'Le taux de chomage baisse parce qu\'on a change la definition du demandeur d\'emploi, pas parce que l\'emploi progresse.', questions: '["L\'indicateur cite a-t-il pu modifier les comportements qu\'il mesure ?","La definition de l\'indicateur a-t-elle change recemment ?","L\'indicateur mesure-t-il vraiment ce qu\'il pretend mesurer ?","Des effets pervers lies a cet indicateur sont-ils documentes ?"]' },
  { nom: 'Glissement semantique', description: 'Un mot ou une expression change subtilement de sens au cours du texte, permettant de conclure abusivement.', exemple: '« Les charges » (cotisations sociales) deviennent des « charges » (poids mort inutile) au fil du discours.', questions: '["Un mot cle change-t-il de sens entre le debut et la fin ?","Le vocabulaire employe oriente-t-il deja l\'interpretation ?","Certains termes sont-ils utilises comme synonymes alors qu\'ils ne le sont pas ?","Le champ lexical est-il neutre ou connotatif ?"]' },
  { nom: 'Effet de cadrage', description: 'La facon de presenter l\'information (cadrage positif/negatif, choix des mots, angle) influence la perception sans mentir.', exemple: '« 10 % de chomage » vs « 90 % de la population active a un emploi » — meme realite, perceptions opposees.', questions: '["L\'information aurait-elle un autre impact si elle etait presentee differemment ?","L\'angle choisi met-il en avant un aspect au detriment d\'un autre ?","Des elements de contexte manquent-ils pour comprendre la situation ?","Le cadrage oriente-t-il vers une conclusion particuliere ?"]' },
  { nom: 'Appel a l\'emotion', description: 'Le discours mobilise les emotions (peur, colere, compassion, degout) pour court-circuiter le raisonnement rationnel.', exemple: 'Images de victimes en gros plan accompagnant un discours securitaire, sans donnees objectives sur l\'insecurite.', questions: '["Le texte ou l\'image cherche-t-il a provoquer une emotion forte ?","L\'emotion ressentie sert-elle de preuve ou d\'argument ?","Des donnees factuelles accompagnent-elles le propos emotionnel ?","Retirerait-on la meme conclusion sans la charge emotionnelle ?"]' },
  { nom: 'Faux dilemme', description: 'Le propos presente seulement deux options (souvent extremes) alors que d\'autres alternatives existent.', exemple: '« Soit on accepte le nucleaire, soit on retourne a la bougie » — ignore les autres sources d\'energie.', questions: '["Le propos presente-t-il la situation comme un choix binaire ?","D\'autres options ou nuances sont-elles possibles ?","Les deux alternatives presentees sont-elles les seules envisageables ?","Le « soit... soit... » masque-t-il une complexite ?"]' },
  { nom: 'Cherry-picking', description: 'Selection de donnees ou d\'exemples qui confirment une these en ignorant deliberement ceux qui la contredisent.', exemple: 'Citer 3 etudes favorables a un produit en taisant les 15 qui montrent son inefficacite.', questions: '["Les exemples ou donnees cites sont-ils representatifs de l\'ensemble ?","Existe-t-il des donnees contradictoires qui ne sont pas mentionnees ?","La periode ou l\'echantillon choisi est-il particulierement favorable a la these ?","L\'auteur a-t-il cherche a infirmer sa propre hypothese ?"]' },
]

const insertMecanisme = db.prepare(
  'INSERT OR IGNORE INTO mecanismes_reference (nom, description, exemple, questions_guidees) VALUES (?, ?, ?, ?)'
)
for (const m of mecanismes) {
  insertMecanisme.run(m.nom, m.description, m.exemple, m.questions)
}

// Seed users
const insertUser = db.prepare(
  'INSERT OR IGNORE INTO utilisateurs (nom, role) VALUES (?, ?)'
)
insertUser.run('HydroLooney', 'admin')
insertUser.run('JonLuk', 'membre')
insertUser.run('Aurelie', 'membre')

// Seed contenus
const insertContenu = db.prepare(
  'INSERT OR REPLACE INTO contenus (cle, titre, contenu) VALUES (?, ?, ?)'
)
insertContenu.run('accueil', 'Bienvenue', `# A la source

Bienvenue dans l'outil d'education populaire de Rouge Coquelicot.

Cet outil permet de collecter, analyser et selectionner des sources mediatiques pour les ateliers « A la source ».`)

insertContenu.run('epoche', 'Le contrat d\'epoche', `# Le contrat d'epoche

Avant chaque atelier, nous convenons collectivement de suspendre nos jugements. Il ne s'agit pas de ne plus avoir d'opinions, mais de les mettre temporairement entre parentheses pour examiner les mecanismes a l'oeuvre dans l'information.

Nous ne sommes pas la pour dire « c'est vrai » ou « c'est faux », mais pour comprendre comment l'information est construite et quels effets elle produit sur nous.`)

console.log('Base initialisee avec succes.')
db.close()
