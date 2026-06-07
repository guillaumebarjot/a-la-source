import { join } from 'path'

// Resolution UNIQUE du chemin de la base « A la source ».
// La base est canonique et vit HORS du repo, dans OneDrive 00_PERSO/A la source/
// (donnees synchronisees par OneDrive ; code par git). Une seule base : celle-ci.
// Racine OneDrive detectee par plateforme (PRO win32 / PERSO darwin),
// surchargeable par ONEDRIVE_ROOT ; chemin complet surchargeable par A_LA_SOURCE_DB.
//
// Tout acces a la base (app, seeds, migrations) DOIT passer par ce chemin, pour
// qu'il n'existe jamais une seconde base divergente dans le repo.
const ONEDRIVE_ROOTS: Record<string, string> = {
  win32: 'C:/Users/guillaume.barjot/OneDrive - ARTELIA',
  darwin: '/Users/invite/Library/CloudStorage/OneDrive-ARTELIA',
}

const ONEDRIVE_ROOT =
  process.env.ONEDRIVE_ROOT || ONEDRIVE_ROOTS[process.platform] || ''

export const DB_PATH =
  process.env.A_LA_SOURCE_DB ||
  join(ONEDRIVE_ROOT, '00_PERSO', 'A la source', 'a-la-source.db')
