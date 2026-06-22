import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Resolution UNIQUE du chemin de la base « A la source ».
//
// Architecture (06/2026) : la base CANONIQUE vit en PROD sur Bomp4rd
// (/srv/a-la-source/data/db/a-la-source.db), sauvegardee par restic (offsite,
// /srv vers Boris) + un backup dedie horodate. La prod fixe son chemin via la
// variable A_LA_SOURCE_DB (=/data/a-la-source.db dans le conteneur).
//
// En DEV local, on ne porte plus toute la base : on travaille sur un ECHANTILLON
// leger fabrique par server/src/scripts/make-dev-db.ts (db/a-la-source-dev.db,
// ignore par git). C'est le defaut ci-dessous. On peut toujours surcharger par
// A_LA_SOURCE_DB (ex. pointer une copie complete recuperee de la prod).
const __dirname = dirname(fileURLToPath(import.meta.url))

// db/ du depot : server/src/db -> server/src -> server -> racine depot, + db/.
const DEV_DB_DEFAULT = join(__dirname, '..', '..', '..', 'db', 'a-la-source-dev.db')

export const DB_PATH = process.env.A_LA_SOURCE_DB || DEV_DB_DEFAULT
