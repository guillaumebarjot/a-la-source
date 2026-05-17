/**
 * Migration — Mecanismes v2 : ajout slug, definition_longue, noms de categories lisibles
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Migration mecanismes v2 — debut')

// Ajouter colonnes
const cols = (db.prepare("PRAGMA table_info(mecanismes_reference)").all() as { name: string }[]).map(c => c.name)

if (!cols.includes('slug')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN slug TEXT;`)
  console.log('  + mecanismes_reference.slug')
}
if (!cols.includes('definition_longue')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN definition_longue TEXT;`)
  console.log('  + mecanismes_reference.definition_longue')
}
if (!cols.includes('categorie_label')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN categorie_label TEXT;`)
  console.log('  + mecanismes_reference.categorie_label')
}
if (!cols.includes('categorie_description')) {
  db.exec(`ALTER TABLE mecanismes_reference ADD COLUMN categorie_description TEXT;`)
  console.log('  + mecanismes_reference.categorie_description')
}

// Fonction slug
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Generer les slugs
const all = db.prepare('SELECT id, nom FROM mecanismes_reference').all() as { id: number; nom: string }[]
const updateSlug = db.prepare('UPDATE mecanismes_reference SET slug = ? WHERE id = ?')
for (const m of all) {
  updateSlug.run(slugify(m.nom), m.id)
}
console.log(`  Slugs generes pour ${all.length} mecanismes`)

// Labels de categories
const catLabels: Record<string, { label: string; description: string }> = {
  'argumentation': {
    label: 'Raisonnement et argumentation',
    description: "Procedes qui detournent les regles du raisonnement logique pour emporter l'adhesion sans demontrer. Sophismes, paralogismes, diversions : ces mecanismes exploitent la structure meme de l'argumentation."
  },
  'cadrage': {
    label: 'Cadrage et mise en scene',
    description: "Comment le choix des mots, de l'angle, du vocabulaire et du perimetre du debat oriente la perception avant meme que l'on ne commence a reflechir. Le cadrage agit en amont de l'argumentation."
  },
  'manipulation': {
    label: 'Manipulation du langage',
    description: "Procedes qui jouent sur les mots, les expressions ou les indicateurs pour modifier subtilement le sens d'un propos, creer des associations trompeuses ou detourner l'attention."
  },
  'manipulation_chiffres': {
    label: 'Manipulation des chiffres',
    description: "Techniques qui utilisent les donnees chiffrees pour impressionner, rassurer ou alarmer, en jouant sur le contexte, la presentation ou l'absence de reference. Un chiffre seul ne dit rien."
  },
  'manipulation_emotion': {
    label: "Manipulation par l'emotion",
    description: "Procedes qui mobilisent la peur, la colere, l'indignation ou l'empathie pour court-circuiter le raisonnement critique. L'emotion n'est pas l'ennemie de la raison, mais elle peut etre instrumentalisee."
  },
  'selection_info': {
    label: "Selection de l'information",
    description: "Mecanismes lies au choix de ce qui est montre et ce qui est cache. Toute information est une selection ; l'enjeu est de savoir si cette selection est transparente et honnete."
  }
}

const updateCat = db.prepare('UPDATE mecanismes_reference SET categorie_label = ?, categorie_description = ? WHERE categorie = ?')
for (const [cat, info] of Object.entries(catLabels)) {
  updateCat.run(info.label, info.description, cat)
}
console.log('  Categories enrichies avec labels et descriptions')

// Definitions longues
const updateDef = db.prepare('UPDATE mecanismes_reference SET definition_longue = ? WHERE slug = ?')

updateDef.run(`L'effet de cadrage (framing effect) designe la maniere dont la presentation d'une information influence sa reception, independamment de son contenu factuel. Le meme fait, enonce de deux facons differentes, produit des reactions opposees.

Ce mecanisme est central dans le traitement mediatique : le choix d'un titre, d'un angle, d'un vocabulaire, d'une image d'illustration, d'un ordre de presentation — tout cela constitue un cadrage. Il n'existe pas d'information « neutre » : presenter un fait, c'est toujours choisir un cadre.

L'enjeu n'est pas de supprimer le cadrage (c'est impossible), mais de le rendre visible. Quand on identifie le cadre, on peut envisager d'autres facons de raconter la meme histoire, et donc mieux comprendre ce qui est en jeu.

Exemples multiples :
- « Reforme des retraites » vs « Recul de l'age de depart » — le meme projet de loi, deux cadrages.
- « Charges patronales » vs « Cotisations sociales » — le premier cadrage presente un poids, le second un investissement.
- Presenter un taux de chomage en valeur absolue (« 3 millions de chomeurs ») ou en pourcentage (« 7,3% ») change la perception de gravite.
- Illustrer un article sur l'immigration avec une photo de foule vs une photo de famille change radicalement la lecture.`, 'effet-de-cadrage')

updateDef.run(`Le chiffre-paravent consiste a mettre en avant un chiffre spectaculaire, impressionnant ou rassurant, pour detourner l'attention du fond du sujet ou masquer une realite plus complexe. Le chiffre agit comme un ecran : il donne l'impression de precision et d'objectivite, mais il empeche de voir ce qui se passe derriere.

Un chiffre isole ne dit jamais rien par lui-meme. Il n'a de sens que contextualise : par rapport a quoi ? sur quelle periode ? mesure comment ? par qui ? dans quel but ? Sans ces elements, un chiffre peut dire tout et son contraire.

Ce mecanisme est particulierement efficace parce que les chiffres beneficient d'un prestige de scientificite. On les conteste rarement, surtout quand ils sont assenes avec assurance.

Exemples multiples :
- « 1 milliard d'euros investis dans l'hopital » — impressionnant, mais rapporte au nombre d'etablissements et etale sur 5 ans, ca represente tres peu par hopital et par an.
- « Le pouvoir d'achat a augmente de 0,3% » — sans dire que les depenses contraintes (loyer, energie) ont augmente de 5%.
- « 90% de satisfaction » — sans preciser le taux de reponse (12%) ni la formulation de la question.
- « La delinquance a baisse de 15% » — en changeant la methode de comptage.`, 'chiffre-paravent')

updateDef.run(`L'argument d'autorite consiste a valider une affirmation non pas par des preuves ou un raisonnement, mais par la reputation, le statut ou le titre de la personne qui l'enonce. « C'est vrai parce que X le dit » — ou X est un·e expert·e, un·e scientifique, un·e personnalite publique.

L'autorite n'est pas illégitime en soi : consulter des expert·es est necessaire. Le probleme survient quand l'autorite se substitue a l'argumentation, quand elle s'exerce hors de son domaine de competence, ou quand elle sert a clore un debat plutot qu'a l'eclairer.

Il faut distinguer l'argument d'autorite (fallacieux) de l'appel a l'expertise (legitime). Le premier dit « croyez-moi parce que je suis important » ; le second dit « voici ce que les donnees montrent, et voici pourquoi je suis qualifie·e pour les interpreter ».

Exemples multiples :
- Un·e economiste invite·e a commenter une question medicale.
- « Le prix Nobel d'economie dit que... » — sans preciser que son Nobel porte sur un tout autre sujet.
- Un·e PDG qui affirme que « les salaires sont corrects » — son statut ne fait pas preuve.
- « Les experts sont unanimes » — sans dire lesquels, ni s'ils·elles sont independant·es.`, 'argument-dautorite')

updateDef.run(`L'appel a l'emotion consiste a mobiliser les sentiments (peur, colere, compassion, indignation, attendrissement) pour emporter l'adhesion sans passer par la demonstration. L'emotion court-circuite le raisonnement critique : on reagit au lieu de reflechir.

L'emotion n'est pas l'ennemie de la raison. Etre emu·e par une injustice, c'est sain. Le probleme survient quand l'emotion est instrumentalisee : quand elle est utilisee deliberement pour empecher l'analyse, detourner l'attention, ou faire accepter une conclusion non demontree.

Le traitement mediatique abuse souvent de l'emotion : temoignages en larmes, images choc, formules hyperboliques, musiques dramatiques dans les reportages. Ces choix editoriaux ne sont pas neutres — ils orientent la reception.

Exemples multiples :
- Un reportage sur l'insecurite qui ouvre par une interview de victime en pleurs, avant toute donnee statistique.
- « Pensez aux enfants ! » comme argument pour justifier n'importe quelle mesure repressive.
- Des images de catastrophe naturelle diffusees en boucle pour susciter un don immediat, sans aucune analyse des causes.
- Un portrait d'entrepreneur·se « parti·e de rien » qui fait pleurer, pour illustrer que « quand on veut, on peut ».`, 'appel-a-l-emotion')

updateDef.run(`Le faux dilemme (ou fausse alternative) consiste a presenter une situation comme n'offrant que deux options — generalement une bonne et une mauvaise — alors que d'autres possibilites existent. C'est une reduction artificielle du champ des possibles.

Ce mecanisme est extremement courant dans le debat public : « C'est ca ou le chaos », « Soit on fait ca, soit on ne fait rien », « Vous etes avec nous ou contre nous ». Il force un choix binaire la ou la realite est nuancee.

Le faux dilemme est efficace parce qu'il simplifie la decision et cree un sentiment d'urgence. Il est souvent combine avec l'appel a la peur (si vous ne choisissez pas A, alors B arrivera).

Exemples multiples :
- « Soit on accepte cette reforme, soit c'est la faillite du systeme. »
- « Nucleaire ou bougie » — comme si les renouvelables n'existaient pas.
- « Securite ou liberte » — comme si les deux etaient necessairement antagonistes.
- « Croissance ou decroissance » — en occultant toute reflexion sur la nature de la croissance.`, 'faux-dilemme')

updateDef.run(`Le cherry-picking (ou tri selectif des donnees) consiste a choisir uniquement les faits, exemples ou donnees qui confirment une these, en ignorant deliberement ceux qui la contredisent. C'est une forme de malhonnetete intellectuelle qui donne l'apparence de la rigueur.

Tout le monde le fait, plus ou moins consciemment — c'est le biais de confirmation. Mais dans le traitement mediatique ou le debat public, le cherry-picking devient un mecanisme de manipulation quand il est systematique et delibere.

L'antidote est simple en theorie (chercher les contre-exemples), mais difficile en pratique car il faut deja avoir les connaissances pour savoir ce qui manque.

Exemples multiples :
- Citer les 3 etudes qui minimisent les effets d'un pesticide, en ignorant les 47 qui les confirment.
- Montrer les jours de froid intense pour nier le rechauffement climatique.
- Interviewer uniquement les habitant·es satisfait·es d'un projet d'amenagement.
- Citer les reussites d'une politique en omettant ses echecs.`, 'cherry-picking')

updateDef.run(`La generalisation abusive consiste a tirer une conclusion generale a partir d'un ou quelques cas particuliers. Un fait divers devient une tendance, une anecdote devient une preuve. C'est l'inverse de la demarche scientifique, qui exige un nombre suffisant d'observations avant de conclure.

Ce mecanisme est omni-present dans le traitement mediatique : les reportages-temoignages donnent l'impression d'une realite generale, alors qu'ils ne montrent que des cas individuels. « J'ai rencontre un·e X qui fait Y, donc les X font Y. »

La generalisation abusive est souvent combinee avec le biais de survie (on ne montre que les cas qui confirment la these) et le cherry-picking.

Exemples multiples :
- « Mon voisin touche le RSA et a une voiture » → « Les beneficiaires du RSA vivent bien. »
- Un fait divers impliquant une personne d'origine etrangere → « L'immigration cause la delinquance. »
- « J'ai arrete l'ecole a 16 ans et j'ai reussi » → « L'ecole ne sert a rien. »
- Trois jours de pluie en ete → « Il n'y a plus de saisons. »`, 'generalisation-abusive')

updateDef.run(`L'homme de paille (straw man) consiste a deformer la position de son adversaire pour la rendre plus facile a attaquer. Au lieu de repondre a l'argument reel, on en fabrique une version caricaturale, on la refute, puis on pretend avoir gagne le debat.

C'est un mecanisme extremement frequente dans le debat public et mediatique, souvent difficile a reperer en temps reel parce que la version caricaturee ressemble suffisamment a l'argument original pour sembler credible.

L'antidote est de toujours verifier : « est-ce vraiment ce que cette personne a dit ? » et de chercher la source originale plutot que le resume qu'en font ses adversaires.

Exemples multiples :
- « Les ecologistes veulent nous ramener a l'age de pierre. »
- « Ceux qui critiquent Israel sont antisemites. »
- « Les syndicats sont contre toute reforme. »
- « Les feministes veulent la domination des femmes sur les hommes. »`, 'homme-de-paille')

updateDef.run(`La pente glissante (slippery slope) consiste a pretendre qu'une mesure, meme modeste, conduira inevitablement a une chaine de consequences catastrophiques. « Si on accepte A, alors B arrivera, puis C, puis D, et ce sera la catastrophe. »

L'enchaainement causal est presente comme inevitable, alors qu'aucune des etapes intermediaires n'est demontree. Chaque maillon de la chaaine est plausible pris isolement, ce qui donne une apparence de logique a l'ensemble, mais la probabilite que tous se realisent est en realite tres faible.

C'est un mecanisme de peur deguise en raisonnement logique. Il sert souvent a bloquer toute evolution en agitant le spectre de consequences extremes.

Exemples multiples :
- « Si on autorise le mariage homosexuel, bientot on autorisera le mariage avec les animaux. »
- « Si on legalise le cannabis, demain ce sera l'heroine. »
- « Si on augmente le SMIC, les entreprises fermeront et il y aura du chomage de masse. »
- « Si on accepte un refugie, c'est la porte ouverte a des millions. »`, 'pente-glissante')

updateDef.run(`La fausse equivalence consiste a mettre sur un pied d'egalite deux positions qui n'ont pas le meme poids factuel, scientifique ou moral. Au nom de l'« equilibre » ou de la « pluralite des opinions », on donne la meme visibilite a une position solidement etayee et a une position marginale ou contredite par les faits.

Ce mecanisme est particulierement insidieux dans le journalisme, ou le reflexe d'« entendre les deux camps » peut conduire a creer un faux equilibre. Donner 50% du temps d'antenne au consensus scientifique et 50% a un·e climato-sceptique, c'est donner l'impression que le debat est ouvert alors qu'il ne l'est pas.

La fausse equivalence mine la capacite du public a distinguer les faits des opinions, et transforme des questions tranchees en « debats ouverts » perpetuels.

Exemples multiples :
- Inviter un·e climatologue et un·e climato-sceptique « pour l'equilibre » — alors que 97% des scientifiques confirment le rechauffement.
- Mettre sur le meme plan une meta-analyse et un blog complotiste.
- « Il y a du pour et du contre » sur l'efficacite des vaccins.
- Opposer un·e historien·ne specialiste et un·e polemiste sur une question historique tranchee.`, 'fausse-equivalence')

updateDef.run(`L'omission consiste a ne pas mentionner une information pertinente qui changerait la comprehension du sujet. L'absence d'information est un choix editorial aussi significatif que sa presence. Ce qui n'est pas dit pese souvent autant que ce qui est dit.

L'omission peut etre deliberee (censure, auto-censure, pression economique) ou inconsciente (angle trop restreint, manque de temps, manque de competence). Dans les deux cas, le resultat est le meme : le public recoit une image incomplete de la realite.

C'est un mecanisme fondamental identifie par Chomsky et Herman dans « Manufacturing Consent » : les filtres mediatiques (propriete, publicite, sources officielles, anti-communisme, flak) produisent une information systematiquement lacunaire, sans necessite de conspiration.

Exemples multiples :
- Un article sur la hausse du chomage qui ne mentionne pas les radiations massives de Pole emploi la meme semaine.
- Couvrir une manifestation en ne parlant que des violences, sans mentionner les revendications.
- Annoncer une baisse d'impots sans dire quels services publics seront coupes pour la financer.
- Ne jamais mentionner les liens d'interet d'un·e expert·e invite·e.`, 'omission')

updateDef.run(`L'inversion de la charge de la preuve consiste a demander a celui ou celle qui subit de prouver qu'il ou elle a raison, au lieu de demander a celui ou celle qui affirme de prouver ses dires. C'est un renversement du principe fondamental de la logique et du droit : c'est a celui qui affirme de demontrer.

Ce mecanisme est particulierement utilise par les industriels : « Prouvez que notre produit est dangereux » au lieu de « Prouvez qu'il est inoffensif avant de le commercialiser ». Le principe de precaution existe precisement pour contrer cette inversion.

C'est aussi un outil rhétorique classique pour disqualifier les lanceurs·ses d'alerte et les victimes : au lieu d'examiner leurs arguments, on exige d'eux·elles une preuve irrefutable que, par definition, ils·elles n'ont pas les moyens de fournir.

Exemples multiples :
- « Prouvez que ce pesticide est dangereux » au lieu de « Prouvez qu'il est inoffensif avant de le commercialiser. »
- « Prouvez que vous etes victime de discrimination » — en l'absence de statistiques ethniques.
- « Si vous n'avez rien a cacher, vous n'avez rien a craindre » — inversion de la preuve en matiere de surveillance.
- « Montrez-moi une seule preuve de corruption » — quand les documents sont classes secret-defense.`, 'inversion-de-la-charge-de-la-preuve')

updateDef.run(`La naturalisation consiste a presenter un fait social, politique ou economique comme naturel, inevitable, ou relevant du bon sens, en masquant qu'il resulte de choix humains, de rapports de force et de constructions historiques. C'est transformer du contingent en necessaire.

Roland Barthes l'a decrit dans « Mythologies » : le mythe « transforme l'histoire en nature ». Ce qui est produit par des decisions politiques, economiques et sociales apparait comme allant de soi, comme « la nature des choses ».

La naturalisation est l'un des mecanismes les plus puissants car il est invisible : quand quelque chose parait naturel, on ne pense meme pas a le questionner. C'est le degre zero de la critique — il n'y a plus rien a critiquer puisque « c'est comme ca ».

Exemples multiples :
- « C'est la loi du marche » — comme si le marche etait un phenomene naturel et non une construction sociale avec des regles modifiables.
- « Il y a toujours eu des riches et des pauvres » — naturalisation des inegalites.
- « Les hommes sont naturellement competitifs » — confusion entre culture et nature.
- « On ne peut pas accueillir toute la misere du monde » — presentation d'un choix politique comme une evidence.`, 'naturalisation')

updateDef.run(`L'euphemisme consiste a utiliser un vocabulaire adouci, technocratique ou abstrait pour masquer la violence, la gravite ou le caractere desagreable d'une situation. Les mots sont choisis pour rendre acceptable ce qui, nomme crument, susciterait le rejet.

Victor Klemperer l'a montre dans « LTI » (Lingua Tertii Imperii) : le langage du Troisieme Reich ne s'est pas impose par des discours enflammes, mais par l'infiltration quotidienne de mots anodins qui banalisaient l'horreur. Eric Hazan l'a actualise dans « LQR » pour montrer comment le langage mediatique contemporain procede de la meme maniere.

L'euphemisme n'est pas un simple probleme de vocabulaire : c'est un outil politique. Renommer, c'est re-cadrer. Et re-cadrer, c'est controler la perception.

Exemples multiples :
- « Plan de sauvegarde de l'emploi » pour un licenciement massif.
- « Frappe chirurgicale » pour un bombardement.
- « Croissance negative » pour une recession.
- « Collaborateur·ice » pour un·e salarie·e (efface le lien de subordination).
- « Quartier sensible » pour un quartier pauvre.`, 'euphemisme')

updateDef.run(`L'amalgame consiste a mettre dans le meme sac des elements distincts pour transferer les proprietes negatives (ou positives) de l'un a l'autre. C'est creer un lien implicite entre deux choses qui n'en ont pas necessairement, en les associant dans le meme discours, la meme phrase, le meme reportage.

L'amalgame fonctionne par contiguite : placer deux choses cote a cote suffit a creer l'impression d'un lien. Il n'est pas necessaire d'affirmer explicitement le lien — la proximite fait le travail.

C'est un mecanisme fondamental de la propagande : associer un groupe social a un danger, une ideologie a un echec, une personne a un scandale, sans jamais avoir a demontrer le lien.

Exemples multiples :
- Associer systematiquement « immigration » et « insecurite » dans un meme sujet, creant un lien implicite sans le demontrer.
- « Islam, radicalisation, terrorisme » — la sequence cree un amalgame entre religion et violence.
- « Ecologie, decroissance, recession » — associer l'ecologie a la privation.
- « Syndicats, greves, blocages » — reduire l'action syndicale a la nuisance.`, 'amalgame')

updateDef.run(`La personnalisation consiste a reduire un enjeu collectif, structurel ou systemique a une personne (hero, bouc emissaire, leader). Cela empeche l'analyse des causes profondes en focalisant l'attention sur un individu.

Ce mecanisme est structurel dans le traitement mediatique : les medias ont besoin de visages, de recits, de personnages. Mais cette logique narrative, quand elle est systematique, empeche de comprendre les mecanismes a l'oeuvre.

La personnalisation marche dans les deux sens : elle peut heroisser (Elon Musk, Steve Jobs) ou diaboliser (les boucs emissaires). Dans les deux cas, elle simplifie abusivement et detourne de l'analyse structurelle.

Exemples multiples :
- Attribuer la crise economique a un·e seul·e dirigeant·e plutot qu'a des mecanismes structurels.
- « La loi Macron » — personnaliser une loi qui resulte d'un processus collectif.
- « Les gilets jaunes, c'est le mouvement d'Eric Drouet » — reduire un mouvement social a une personne.
- Le hero entrepreneur·se « qui a tout fait tout·e seul·e » — invisibilisation du collectif.`, 'personnalisation')

updateDef.run(`Le faux consensus consiste a presenter une opinion minoritaire ou contestee comme largement partagee (« tout le monde sait que... »), ou inversement a minimiser un consensus reel (« le debat est loin d'etre tranche »). Dans les deux cas, il s'agit de manipuler la perception de ce que « les gens pensent ».

Ce mecanisme exploite notre tendance a nous aligner sur ce que nous percevons comme la norme sociale. Si on nous dit que « tout le monde » pense X, nous sommes plus enclins a le penser aussi — ou au moins a ne pas le contester publiquement.

Oreskes et Conway ont montre dans « Merchants of Doubt » comment les industriels du tabac, puis du petrole, ont deliberement fabrique un faux debat scientifique pour retarder l'action publique. Minimiser le consensus scientifique est une strategie industrielle documentee.

Exemples multiples :
- « Tout le monde sait que... » pour une opinion controversee.
- « Le debat est loin d'etre tranche » sur le rechauffement climatique — alors que 97% des scientifiques sont d'accord.
- Sondages avec questions orientees qui produisent un consensus artificiel.
- « Les Francais·es ne veulent plus de... » — generalization a partir d'un sondage.`, 'faux-consensus')

updateDef.run(`Le whataboutisme (ou « tu quoque ») consiste a repondre a une critique en pointant un probleme ailleurs, sans jamais repondre sur le fond. « Oui mais les autres aussi... » C'est une diversion qui detourne le debat de la question initiale.

Ce terme vient de la pratique de la propagande sovietique pendant la Guerre froide : a chaque critique des droits humains en URSS, la reponse etait « Et en Amerique, qu'est-ce que vous faites des Noirs ? » (what about...). La critique etait legitime, mais elle servait de diversion, pas de reponse.

Le whataboutisme est insidieux parce que les exemples invoques sont souvent vrais. Oui, « les autres » font aussi des choses reprehensibles. Mais cela ne repond pas a la critique initiale — c'est juste un changement de sujet.

Exemples multiples :
- « Oui mais les autres pays polluent aussi » en reponse a une critique sur les emissions nationales.
- « Et quand la gauche etait au pouvoir, elle n'a rien fait non plus » — pour esquiver une critique.
- « Vous critiquez la France, mais regardez ce qui se passe en Chine » — pour couper court.
- « Les ecologistes prennent l'avion aussi » — pour disqualifier une critique structurelle par un comportement individuel.`, 'whataboutisme')

updateDef.run(`L'appel a la tradition consiste a justifier une pratique, une institution ou une regle par son anciennete plutot que par sa pertinence actuelle. « On a toujours fait comme ca » devient un argument suffisant pour ne rien changer.

C'est un sophisme classique (argumentum ad antiquitatem) : l'anciennete d'une pratique ne dit rien de sa valeur. L'esclavage a dure des millenaires, ce n'etait pas un argument pour le maintenir.

L'appel a la tradition est souvent combine avec la naturalisation (« c'est dans la nature des choses ») et avec l'appel a la peur (« si on change, ce sera pire »). Il est particulierement efficace dans les debats de societe ou les resistances au changement.

Exemples multiples :
- « On a toujours fait comme ca » comme argument contre une reforme.
- « Le mariage, c'est entre un homme et une femme depuis toujours » — argument historiquement faux, d'ailleurs.
- « Les femmes n'ont jamais occupe ce poste » — comme si l'histoire passee determinait l'avenir.
- « Cette tradition remonte au Moyen Age » — sans se demander si les conditions du Moyen Age sont pertinentes aujourd'hui.`, 'appel-a-la-tradition')

updateDef.run(`La decontextualisation consiste a extraire une citation, un fait ou un chiffre de son contexte pour lui faire dire autre chose que son sens original. C'est l'un des mecanismes les plus courants et les plus difficiles a reperer, parce que les elements cites sont authentiques — seul le contexte manque.

La phrase tronquee, le chiffre sans reference, la citation sans la nuance qui suit : tout cela produit une information techniquement « vraie » mais factuellement trompeuse. C'est la forme la plus sophistiquee de desinformation : on ne ment pas, on deforme.

L'antidote est simple mais exigeant : toujours chercher la source originale. Toujours lire la phrase entiere, le paragraphe entier, le rapport entier. C'est un effort que peu de gens font, et les manipulateurs le savent.

Exemples multiples :
- Citer une phrase d'un rapport en ignorant la nuance qui suit immediatement.
- « La pauvrete recule » — vrai en chiffres relatifs, faux en chiffres absolus.
- Reprendre un tweet sorti de son fil pour lui faire dire l'inverse.
- Extraire 3 secondes d'un discours de 45 minutes pour en faire un titre.`, 'decontextualisation')

updateDef.run(`L'effet de repetition (ou « illusory truth effect ») est le mecanisme par lequel une affirmation repetee suffisamment souvent finit par etre tenue pour vraie, independamment des preuves. La familiarite engendre la credibilite.

Ce phenomene a ete demontre experimentalement par Hasher, Goldstein et Toppino en 1977 : des affirmations repetees sont jugees plus credibles que des affirmations nouvelles, meme quand les sujets savent qu'elles sont fausses. Notre cerveau confond « deja entendu » et « vrai ».

Dans l'ecosysteme mediatique contemporain, la repetition est amplifiee par les chaines d'info en continu, les reseaux sociaux et le copier-coller inter-redactions. Un chiffre faux repris par 50 medias en 24h acquiert une solidite apparente que plus personne ne songe a verifier.

Exemples multiples :
- Un chiffre faux repris par tous les medias sans verification pendant plusieurs jours.
- « L'islam est la premiere religion de France » — repetee jusqu'a devenir « evidence » pour beaucoup.
- Les « elements de langage » repetes par tous·tes les porte-parole d'un parti le meme jour.
- Un slogan publicitaire qui finit par sembler vrai a force de repetition (« Actimel renforce vos defenses naturelles »).`, 'effet-de-repetition')

updateDef.run(`Le biais de survie consiste a ne prendre en compte que les cas qui ont « reussi » en ignorant tous ceux qui ont echoue, ce qui donne une image faussee de la realite. On ne voit que les survivant·es, jamais les disparu·es.

Le concept a une origine militaire : pendant la Seconde Guerre mondiale, le statisticien Abraham Wald a montre qu'il ne fallait pas renforcer les avions la ou on voyait des impacts de balles (zones ou les avions revenaient), mais la ou on n'en voyait pas (zones ou les avions ne revenaient pas, parce qu'ils avaient ete abattus).

Dans le traitement mediatique, le biais de survie est omni-present : on interview les entrepreneur·ses qui ont reussi, les artistes celebres, les sportif·ves au sommet — jamais les 95% qui ont echoue. Cela cree une illusion systematique sur les chances de succes.

Exemples multiples :
- Interviewer des entrepreneur·ses a succes pour prouver que « quand on veut on peut », en ignorant les 90% qui echouent.
- Les « self-made men/women » qui racontent leur parcours — sans mentionner l'heritage, le reseau, la chance.
- « Les gens qui mangent bio vivent plus vieux » — sans controler les autres variables (classe sociale, acces aux soins).
- Presenter les start-ups qui ont « fait une licorne » sans parler des milliers de faillites.`, 'biais-de-survie')

updateDef.run(`La fausse causalite (post hoc ergo propter hoc, ou cum hoc ergo propter hoc) consiste a presenter deux evenements correles comme ayant un lien de cause a effet, sans le demontrer. « A s'est produit, puis B s'est produit, donc A a cause B. »

La correlation n'est pas la causalite — c'est l'un des principes fondamentaux de la methode scientifique, et l'une des erreurs les plus courantes dans le debat public. Deux phenomenes peuvent varier ensemble pour de nombreuses raisons : cause commune, hasard, variable cachee.

Ce mecanisme est particulierement exploite en politique : on attribue a une mesure un resultat qui peut avoir mille autres causes. Et on ne peut generalement pas tester le contrefactuel (que se serait-il passe sans la mesure ?).

Exemples multiples :
- « Depuis qu'on a installe des cameras, la delinquance a baisse » — sans considerer les autres facteurs (policiers supplementaires, gentrification, changement de methodologie).
- « Ce medicament m'a gueri » — sans groupe temoin, c'est indecidable.
- « Les pays qui ont confine le plus ont eu le plus de morts » — correlation sans controle des variables.
- « Depuis l'election de X, le chomage a baisse » — tendance qui avait commence avant.`, 'fausse-causalite')

updateDef.run(`La fenetre d'Overton designe l'eventail des idees considerees comme acceptables dans le debat public a un moment donne. Deplacer cette fenetre consiste a introduire des positions extremes pour rendre les positions auparavant inacceptables plus moderees par comparaison.

Ce concept, formule par Joseph Overton (Mackinac Center), explique comment les idees politiques evoluent : ce qui etait impensable hier peut devenir debattable aujourd'hui et consensuel demain, par un deplacement progressif des limites du debat.

C'est un mecanisme de cadrage a long terme : on ne cherche pas a convaincre directement, mais a modifier le terrain sur lequel le debat a lieu. En rendant dicible l'extreme, on normalise le radical.

Exemples multiples :
- Proposer l'expulsion de tous les etrangers pour rendre « acceptable » la suppression du droit d'asile, qui semble alors « moderee ».
- Proposer la privatisation totale de la sante pour rendre « raisonnable » la fermeture de quelques hopitaux.
- Banaliser un vocabulaire auparavant tabou dans les medias mainstream.
- Le concept de « deplacement du centre de gravite politique » : les positions « centristes » d'aujourd'hui auraient ete considerees comme droite il y a 30 ans.`, 'fenetre-d-overton')

updateDef.run(`L'appel a la peur consiste a utiliser la peur comme levier pour faire accepter une mesure, un produit ou une idee, en exagerant un danger ou en fabriquant un sentiment d'urgence. La peur desactive le raisonnement critique et pousse a l'action impulsive.

Barry Glassner l'a analyse dans « The Culture of Fear » : les medias et les politiques cultivent des peurs souvent disproportionnees par rapport aux risques reels. On craint ce qui fait de bons recits (terrorisme, criminalite spectaculaire) plus que ce qui tue reellement (pollution, accidents domestiques, maladies chroniques).

L'appel a la peur est souvent combine avec le faux dilemme (« si vous n'acceptez pas cette mesure, la catastrophe arrivera ») et le chiffre-paravent (un chiffre effrayant sans contexte).

Exemples multiples :
- « Sans cette loi, le terrorisme frappera demain » — pour justifier une restriction des libertes.
- « Les migrants arrivent par millions » — exageration chiffree pour susciter la peur.
- « Si on ne reforme pas, c'est la faillite » — peur economique pour faire accepter des reculs sociaux.
- Surcouverture mediatique des faits divers violents, qui cree un sentiment d'insecurite deconnecte de la realite statistique.`, 'appel-a-la-peur')

// Mecanismes de la categorie "manipulation" (les originaux)
updateDef.run(`La correlation/causalite est l'une des confusions les plus repandues dans le traitement de l'information. Deux phenomenes varient ensemble (correlation), et on en conclut que l'un cause l'autre (causalite), sans aucune demonstration.

Le site « Spurious Correlations » de Tyler Vigen illustre brillamment l'absurdite de ce raccourci : le nombre de noyades en piscine est fortement correle avec le nombre de films dans lesquels Nicolas Cage joue. Personne ne conclurait a un lien de causalite — et pourtant, avec des sujets moins absurdes, on le fait constamment.

En statistiques, on distingue au moins quatre situations : causalite directe (A cause B), causalite inverse (B cause A), variable cachee (C cause A et B), et simple hasard. Seule une analyse rigoureuse (experience controlee, analyse multivariee) permet de trancher.

Exemples multiples :
- « Les departements qui ont le plus de gendarmes ont le plus de criminalite » — on y met des gendarmes PARCE QU'il y a de la criminalite, pas l'inverse.
- « Les gens qui mangent bio sont en meilleure sante » — variable cachee : classe sociale.
- « Les pays les plus vaccines ont le plus de cas » — parce qu'ils testent plus.
- « Depuis l'arrivee de la 5G, les maladies augmentent » — correlation temporelle sans aucun lien demontre.`, 'correlation-causalite')

updateDef.run(`Le glissement semantique designe le procede par lequel un mot ou une expression change subtilement de sens au cours d'un texte, d'un debat ou d'un discours, permettant de passer d'une affirmation acceptable a une conclusion inacceptable sans que le glissement soit percu.

C'est un mecanisme elegant et difficile a reperer : on commence avec un mot dans un sens precis, puis on l'utilise progressivement dans un sens different, et la conclusion repose sur le second sens alors qu'elle a ete acceptee sur la base du premier.

En philosophie, on parle d'equivocation : utiliser le meme mot dans deux sens differents dans un meme raisonnement. Dans le langage mediatique, le glissement est souvent inconscient mais n'en est pas moins efficace.

Exemples multiples :
- « Liberte » : liberte individuelle → liberte d'entreprendre → deregulation → suppression du droit du travail.
- « Securite » : securite physique → securite publique → videosurveillance generalisee.
- « Reforme » : a l'origine, ameliorer un systeme — devenu synonyme de coupe budgetaire.
- « Communaute » : groupe de personnes → euphemisme pour « origine ethnique ».`, 'glissement-semantique')

updateDef.run(`La performativite de l'indicateur decrit le phenomene par lequel un indicateur cense mesurer une realite finit par modifier les comportements au point de ne plus rien mesurer fidelement. On optimise pour l'indicateur, pas pour ce qu'il est cense representer.

C'est la loi de Goodhart : « Quand une mesure devient un objectif, elle cesse d'etre une bonne mesure. » Ce phenomene est massif dans les politiques publiques, les entreprises et les medias.

Dans le domaine mediatique, l'audience (mesure de ce que les gens regardent) est devenue l'objectif (produire ce qui fait de l'audience), ce qui a transforme le contenu mediatique en machine a capter l'attention plutot qu'a informer.

Exemples multiples :
- Le taux de chomage baisse parce qu'on change la definition du chomeur, pas parce qu'il y a plus d'emplois.
- Les hopitaux « optimisent » leur codage pour ameliorer leur classement, pas leurs soins.
- Les classements universitaires (Shanghai) amenent les universites a optimiser les criteres du classement plutot que la qualite de l'enseignement.
- Les chiffres de la delinquance varient selon la « politique du chiffre » de la police.`, 'performativite-de-l-indicateur')

updateDef.run(`Le titre-appat (clickbait) est un titre concu pour provoquer le clic ou l'attention plutot que pour informer fidelement sur le contenu. Il ne correspond pas au contenu de l'article, ou en deforme le propos pour attirer le lecteur.

Le titre-appat exploite la curiosite, l'indignation ou la promesse de revelation : « Vous n'allez pas croire ce que... », « La verite sur... », « Ce que les medias ne vous disent pas sur... ». Le contenu, derriere le clic, est souvent banal, nuance, ou carrément different de ce que le titre laissait entendre.

Le titre-appat est un symptome du modele economique de l'information en ligne : l'audience (et donc la publicite) depend du nombre de clics, ce qui pousse les redactions a privilegier l'accroche sur la fidelite. C'est un cas de performativite de l'indicateur applique au journalisme.

Exemples multiples :
- « Un aliment du quotidien serait dangereux pour la sante » — et l'article parle d'une etude preliminaire sur les souris.
- « Macron desavoue par son propre camp ! » — et un·e seul·e depute·e a exprime un bémol.
- « La methode miracle pour perdre du poids » — et c'est « manger equilibre et bouger ».
- « Ce pays europeen a trouve la solution au chomage » — et le taux est passe de 6,2% a 5,8%.`, 'titre-appat')

console.log('  Definitions longues ajoutees pour les 25 mecanismes')

console.log('Migration mecanismes v2 — terminee')
db.close()
