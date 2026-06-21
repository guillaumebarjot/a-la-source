/**
 * Seed — Amorcer 3 vrais dossiers thématiques (Chantier #2).
 *
 * Donne vie au socle Activités en créant 3 dossiers réels adossés à leurs
 * sujets, pour incarner le format « dossier » (collectionner des sources sur un
 * thème dans la durée, avec une mise en perspective d'éducation populaire) et
 * sortir des activités « Test ». Cf. docs/conception-activites-dossier-debunkage.md
 * et docs/audit-bdd-2026-06-21.md.
 *
 * Pour chaque dossier :
 *   - une ligne activites (type 'dossier', sujet_id renseigné, statut 'brouillon') ;
 *   - une ligne dossier_contenu avec une mise_en_perspective_md rédigée (200-400
 *     mots), sourcée sur les sources réelles du corpus (R1 : on ne dit que ce que
 *     disent les sources rattachées au sujet, lues dans la base) ;
 *   - un corpus de sources tiré de sujet_sources, ordonné, SANS rôle pour/contre
 *     (un dossier collectionne, il ne tranche pas : le rôle est l'apanage du
 *     débunkage).
 *
 * IDEMPOTENT : repérage par (titre, sujet_id). Si le dossier existe déjà, on ne
 * le recrée pas et on ne réécrit pas son contenu (relance = 0 création). Le
 * corpus est rattaché en INSERT OR IGNORE.
 *
 * SÉCURITÉ : réutilise le garde-fou de completion/_shared.ts (refuse --apply sur
 * un chemin qui ressemble à la canonique OneDrive). Mode --dry-run par défaut.
 *
 *   A_LA_SOURCE_DB=/tmp/als-dossiers.db npx tsx server/src/scripts/seed-dossiers.ts            # dry-run
 *   A_LA_SOURCE_DB=/tmp/als-dossiers.db npx tsx server/src/scripts/seed-dossiers.ts --apply    # écrit
 */
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseMode, openGuarded, banner } from './completion/_shared.js'

interface DossierSeed {
  sujet_id: number
  sujet_slug: string
  titre: string
  mise_en_perspective_md: string
  /** Corpus ordonné : ids de sources, dans l'ordre éditorial voulu. */
  corpus: number[]
}

/**
 * Les 3 dossiers à amorcer. Le corpus est un sous-ensemble ORDONNÉ des sources
 * déjà rattachées au sujet (vérifié par garde anti-orphelin avant écriture).
 * L'ordre suit un fil éditorial : on ouvre par la pièce de cadrage (carte de
 * propriété, panorama), puis on déroule chronologiquement / thématiquement.
 */
const DOSSIERS: DossierSeed[] = [
  {
    sujet_id: 13,
    sujet_slug: 'agriculture-pesticides-alsace-nord',
    titre: 'Pesticides et fabrique de la loi : qui écrit la règle agricole ?',
    mise_en_perspective_md:
      "Ce dossier rassemble, dans la durée, les sources qui éclairent un même fil : comment se décide la place des pesticides dans l'agriculture française, et qui tient la plume. On n'y cherche pas un verdict, mais une structure à donner à voir.\n\n" +
      "Un premier ensemble de sources documente la fabrique de la loi. The Conversation décrit comment la loi Duplomb « reprend mot pour mot les revendications de la FNSEA » ; Reporterre va plus loin et chiffre « 783 amendements fournis clés en main par la FNSEA depuis 2024 », rédigés « secrètement » avec des députés. Mis côte à côte, ces deux titres posent une question de méthode démocratique : qui écrit le texte que voteront les élus ?\n\n" +
      "Un deuxième ensemble suit la riposte et les rebonds. Après la censure partielle du texte, les DNA rapportent une « opération rayons vides » de la FDSEA et des JA du Bas-Rhin dans des supermarchés du nord du département ; LCP montre les défenseurs du texte passant « à l'offensive » avec un « Duplomb 2 » pour réautoriser des pesticides ; Libération signale qu'« une vingtaine de biologistes français attaquent le texte dans la revue Science ». Le conflit n'est donc pas clos : il se rejoue à chaque échéance.\n\n" +
      "Un troisième ensemble remet des faits scientifiques dans la balance, sans les présenter comme un bloc. 20 Minutes note que « depuis l'interdiction des néonicotinoïdes, la population d'oiseaux s'est remplumée » ; à l'inverse, le JNE met en garde contre l'opposition trop commode entre « la science » et « la FNSEA » comme « deux blocs monolithiques », alors que « le débat est nuancé ». Le glyphosate réautorisé « pour dix ans malgré les contestations » (Le Monde) et le dossier du cadmium dans les engrais phosphatés (La France Agricole, 20 Minutes) montrent que la décision se joue aussi à l'échelle européenne.\n\n" +
      "Lire ces sources ensemble, c'est moins choisir un camp que repérer un mécanisme récurrent : un cadrage qui oppose environnement et agriculture, et une fabrique de la norme où le poids des lobbies se lit à la trace. À chacun de poursuivre l'enquête.",
    // Fabrique de la loi -> riposte/rebonds -> science et cadre européen.
    corpus: [234, 235, 293, 239, 23, 49, 128, 163, 84, 38, 82, 81, 83, 45],
  },
  {
    sujet_id: 9,
    sujet_slug: 'propriete-concentration-medias',
    titre: 'Qui possède quoi ? Concentration des médias et pluralisme',
    mise_en_perspective_md:
      "Ce dossier collectionne les sources qui permettent de comprendre, dans la durée, une structure plutôt qu'un fait isolé : à qui appartiennent les médias français, et ce que cette propriété fait au pluralisme. La posture est celle d'Acrimed, observatoire allié et nommé : on donne à voir, on ne note pas les rédactions.\n\n" +
      "La pièce maîtresse est cartographique. La carte « Médias français : qui possède quoi ? » d'Acrimed et du Monde diplomatique, ici dans sa version de décembre 2025, résume le propos d'une formule : « qui possède dirige ». Oxfam France et l'émission de France Culture « La Fabrique de l'information » convergent sur un même ordre de grandeur : « neuf milliardaires détiennent environ 80 % des titres », et le rachat de Challenges par LVMH ravive le débat sur une loi de 1986 jugée « obsolète ». La concentration n'est donc pas une opinion, c'est une donnée de structure.\n\n" +
      "Un deuxième ensemble montre cette structure en mouvement, autour du groupe Bolloré. Télérama écrit que ce groupe « empoisonne toujours plus le débat public » ; Libération rapporte une première condamnation de CNews « pour désinformation climatique » ; The Conversation s'interroge sur les raisons pour lesquelles l'Arcom « n'a jamais sanctionné CNews pour manquement au pluralisme ». 20 Minutes documente enfin une riposte institutionnelle : Radio France et France TV « portent plainte contre CNews, Europe 1 et le JDD ».\n\n" +
      "Un troisième ensemble est plus inattendu et oblige à la prudence : la bataille se mène aussi sur l'audiovisuel public. Autour du « rapport Alloncle » qui prétend mesurer le pluralisme par intelligence artificielle, les sources se contredisent ouvertement (Le Point, La Revue du Digital, France Inter, LaScam, l'Institut Thomas More). On tient là, en direct, un cas d'école : un même rapport raconté en sens opposés selon le média.\n\n" +
      "Mis bout à bout, ces documents n'imposent pas une conclusion : ils donnent les pièces pour penser le lien entre propriété, financement et liberté d'informer, et pour repérer d'où parle chaque source.",
    // Cartographie/structure -> Bolloré et sanctions -> bataille audiovisuel public.
    corpus: [275, 255, 274, 273, 166, 76, 176, 167, 64, 116, 117, 67, 66, 63],
  },
  {
    sujet_id: 11,
    sujet_slug: 'pfas-nappe-rhenane',
    titre: 'PFAS dans la nappe rhénane : lire un même fait à travers ses cadrages',
    mise_en_perspective_md:
      "Ce dossier réunit les sources qui parlent des « polluants éternels » dans l'eau, et particulièrement de la nappe rhénane. L'intérêt pédagogique n'est pas de trancher entre alarme et minimisation, mais de mettre en regard des traitements très différents d'un même fait, comme le ferait une comparaison de couverture.\n\n" +
      "Le cœur du dossier est une mise en regard explicite. Sur la même donnée locale, deux titres opposés se répondent : Rue89 Strasbourg parle d'une nappe « intoxiquée » à « 96 % », quand France Bleu Alsace retient « des concentrations faibles selon l'APRONA ». Vert.eco relie ce « 96 % des points de mesure » au projet Ermes-ii-Rhin et rappelle l'enjeu : la nappe alimente cinq millions d'habitants. L'accroche de plusieurs sources met d'ailleurs en garde sur le chiffre lui-même : selon Franceinfo, « les PFAS n'ont pas augmenté, c'est la mesure qui a commencé », et l'UFC-Que Choisir reconnaît qu'un échantillon de trente communes reste « minuscule ».\n\n" +
      "Un deuxième ensemble éclaire le poids des intérêts économiques. Le JT de France 2 montre que « SEB/Tefal obtient une exemption » sur les ustensiles de cuisine ; Reporterre titre sur une « victoire pour les industriels », la taxe PFAS « repoussée de six mois », tout en assumant que le mot « victoire » est un cadrage. Le Monde rappelle qu'un rapport scientifique « recommande une large restriction par l'UE ».\n\n" +
      "Un troisième ensemble donne à voir qui parle. France Bleu rapporte un élu de l'Eurométropole affirmant « aucun risque » : l'accroche invite à noter que c'est « un vice-président, pas un toxicologue ». À l'inverse, Alsace Nature et l'ADRA engagent « une action en justice » contre l'EuroAirport pour la pollution de la nappe, et France Inter consacre une émission au « procès des 200 ». Le titre « Alerte » de CNews, lui, « vise la peur » sans donner de concentrations.\n\n" +
      "Le fil de ce dossier est donc une leçon de lecture : un même fait change de visage selon le titre, le chiffre choisi et la voix qu'on fait parler.",
    // Mise en regard du fait local -> intérêts économiques -> qui parle (institutions, justice, peur).
    corpus: [228, 229, 277, 223, 237, 231, 236, 78, 230, 278, 28, 224, 14, 79],
  },
]

interface SummaryRow {
  titre: string
  sujet: string
  cree: boolean
  nbCorpus: number
}

function seedDossier(db: DatabaseType, d: DossierSeed, apply: boolean): SummaryRow {
  // Garde-fou orphelin : tout id de corpus doit déjà être rattaché au sujet via
  // sujet_sources. On ne « collectionne » que dans le vivier réel du thème (R1).
  const attachees = new Set(
    (db.prepare('SELECT source_id FROM sujet_sources WHERE sujet_id = ?').all(d.sujet_id) as {
      source_id: number
    }[]).map((r) => r.source_id),
  )
  const horsSujet = d.corpus.filter((id) => !attachees.has(id))
  if (horsSujet.length > 0) {
    throw new Error(
      `Dossier « ${d.titre} » : sources ${horsSujet.join(', ')} non rattachées au sujet ${d.sujet_id} (sujet_sources). Refus.`,
    )
  }

  // Idempotence : repérage par (titre, sujet_id).
  const existant = db
    .prepare("SELECT id FROM activites WHERE type = 'dossier' AND titre = ? AND sujet_id = ?")
    .get(d.titre, d.sujet_id) as { id: number } | undefined

  if (existant) {
    console.log(`= déjà présent : « ${d.titre} » (activite #${existant.id}, sujet ${d.sujet_slug}) — aucune création.`)
    const nb = (db.prepare('SELECT COUNT(*) AS n FROM activite_sources WHERE activite_id = ?').get(existant.id) as {
      n: number
    }).n
    return { titre: d.titre, sujet: d.sujet_slug, cree: false, nbCorpus: nb }
  }

  console.log(`+ à créer : « ${d.titre} » (sujet ${d.sujet_slug}, ${d.corpus.length} sources)`)

  if (!apply) {
    return { titre: d.titre, sujet: d.sujet_slug, cree: true, nbCorpus: d.corpus.length }
  }

  const tx = db.transaction(() => {
    const r = db
      .prepare("INSERT INTO activites (type, sujet_id, titre, statut) VALUES ('dossier', ?, ?, 'brouillon')")
      .run(d.sujet_id, d.titre)
    const aid = Number(r.lastInsertRowid)
    db.prepare(
      'INSERT INTO dossier_contenu (activite_id, mise_en_perspective_md, contenu_md, a_chaud, evenement_id) VALUES (?, ?, NULL, 0, NULL)',
    ).run(aid, d.mise_en_perspective_md)
    const ins = db.prepare(
      'INSERT OR IGNORE INTO activite_sources (activite_id, source_id, ordre, role) VALUES (?, ?, ?, NULL)',
    )
    d.corpus.forEach((sid, i) => ins.run(aid, sid, i))
    return aid
  })
  const aid = tx()
  console.log(`  -> activite #${aid} créée, ${d.corpus.length} sources rattachées.`)
  return { titre: d.titre, sujet: d.sujet_slug, cree: true, nbCorpus: d.corpus.length }
}

function main(): void {
  const mode = parseMode()
  banner('Seed dossiers thématiques (Chantier #2)', mode)
  const db = openGuarded(mode)

  const summary: SummaryRow[] = []
  try {
    for (const d of DOSSIERS) {
      summary.push(seedDossier(db, d, mode.apply))
    }
  } finally {
    db.close()
  }

  const crees = summary.filter((s) => s.cree).length
  console.log('')
  console.log('## Bilan')
  for (const s of summary) {
    const tag = s.cree ? (mode.apply ? 'créé' : 'à créer') : 'inchangé'
    console.log(`- [${tag}] ${s.titre} (sujet ${s.sujet}, ${s.nbCorpus} sources)`)
  }
  console.log('')
  console.log(`${crees} dossier(s) ${mode.apply ? 'créé(s)' : 'à créer'}, ${summary.length - crees} déjà présent(s).`)
  if (!mode.apply) {
    console.log('DRY-RUN : aucune écriture. Relancer avec --apply sur une COPIE de la base pour appliquer.')
  }
}

main()
