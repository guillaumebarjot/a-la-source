# Acces, utilisateurs et identite - « A la source »

Comment l'application authentifie, gere les utilisateurs et les droits. Etat
reel au 11/06/2026 (verifie dans le code et la base), puis modele recommande.

---

## 1. Authentification : Authentik forward-auth (PIAF)

En production (Bomp4rd, `alasource.barjot.net`), l'application est servie derriere
**Authentik** (SSO de l'infra PIAF, en forward-auth via NPM). L'app ne gere
**aucun mot de passe** : NPM interroge Authentik et transmet l'identite et les
groupes dans des en-tetes poses par la sous-requete d'auth (anti-usurpation : NPM
ecrase toute valeur envoyee par le client). Le middleware `authMiddleware`
(`server/src/lib/auth.ts`) :

1. lit l'identite dans `X-authentik-username` (repli `Remote-User` pour l'ancien
   SSO YunoHost, puis `?_user=` en dev) ;
2. derive un role plancher des groupes (`X-authentik-groups`) : `admins`,
   `sso-admins`, `rc-admins` ouvrent `admin` ; tout autre compte ayant franchi le
   forward-auth entre `membre` ;
3. cherche l'utilisateur en base (`utilisateurs.nom`, si `actif = 1`) ; s'il est
   inconnu, **cree** un compte avec le role accorde (auto-provisioning) ;
4. attache `req.user = { id, nom, role }`, le role effectif etant le **plus haut**
   entre le role en base (qu'un admin peut elever, ex. `animateur`) et le role SSO.

Groupes Authentik autorises a l'acces (bindings du blueprint `alasource`) :
`rc-membres`, `rc-admins`, `piafs`, `admins`. Le vrai groupe des membres Rouge
Coquelicot est `rc-membres`.

### Developpement

Hors production (`NODE_ENV !== 'production'`), l'utilisateur par defaut est
`HydroLooney`, surchargeables par `?_user=Nom` dans l'URL. Ce fallback est
strictement reserve au dev : il ne doit jamais pouvoir s'activer en prod.

### Routes publiques

Les pages de partage `/partage/*` (OpenGraph pour Discord) sont concues pour etre
publiques. Tant que **tout est garde derriere le SSO** (choix initial du
deploiement PIAF), elles le sont aussi. Pour les rouvrir (apercus de liens dans
Discord), ajouter une exception sans auth sur `/partage/` dans l'hote NPM
(equivalent des `skipped_uris` de l'ancien deploiement YunoHost).

---

## 2. Roles

La base definit trois roles (CHECK dans `schema.sql`) :

| Role (valeur technique) | Etiquette affichee | Sens |
|---|---|---|
| `membre` | Membre | participe : soumet, commente, evalue, identifie, cree des activites |
| `animateur` | Facilitateur·ice | anime : gere les ateliers, publie les sujets |
| `admin` | Admin | administre : parametres, utilisateurs, suppression |

> Note de vocabulaire : la **valeur en base et en code est `animateur`**.
> L'interface et la documentation parlent de « facilitateur·ice ». C'est le
> meme role. Ne pas introduire de valeur `facilitateur` en base.

Les gardes cote serveur utilisent `requireRole(...)` ; l'admin gere les roles
via `PATCH /api/auth/users/:id`.

### Population reelle (base de dev OneDrive, 11/06/2026)

Trois comptes : `HydroLooney` (admin), `JonLuk` (membre), `Aurelie` (membre).
Aucun compte `animateur` a ce jour : les routes reservees `animateur`/`admin`
ne sont donc accessibles qu'a l'admin tant qu'aucun facilitateur n'est promu.

---

## 3. Matrice « qui voit / fait quoi »

Etablie depuis les `requireRole(...)` reels du code.

| Capacite | Public | membre | animateur | admin |
|---|---|---|---|---|
| Pages `/partage/*` (objets publies) | oui | oui | oui | oui |
| Lire veille / sujets / sources | non | oui | oui | oui |
| Soumettre, commenter, evaluer, identifier mecanisme | non | oui | oui | oui |
| Marquer lu / recommander | non | oui | oui | oui |
| Creer une activite (dossier, debunk, arpentage, parcours) | non | oui | oui | oui |
| Gerer les ateliers (creer, sources, synthese, editer) | non | non | oui | oui |
| Publier un sujet | non | non | oui | oui |
| Supprimer une source | non | non | oui | oui |
| Modifier les parametres globaux | non | non | non | oui |
| Gerer utilisateurs et roles | non | non | non | oui |

---

## 4. Risques et durcissement

1. **Confiance dans `Remote-User`.** Si Node etait joignable directement (hors
   proxy SSO), un header `Remote-User` force usurperait n'importe quelle
   identite. **En prod, Node doit n'ecouter que sur `127.0.0.1`** et n'etre
   atteignable que derriere nginx/SSO YunoHost. A verifier au point commun.

2. **Base de travail sur OneDrive ARTELIA (compte professionnel).** Les donnees
   de l'association vivent, en dev, sur l'espace cloud d'un employeur
   (`server/src/db/dbPath.ts`). C'est un risque de gouvernance/confidentialite.
   - La **prod** doit utiliser une base LOCALE au serveur YunoHost, jamais
     OneDrive.
   - OneDrive = poste de dev de Guillaume uniquement. A clarifier et, a terme,
     a sortir d'un espace professionnel.

3. **Pas de journal d'attribution de role.** Acceptable a 3 comptes ; a prevoir
   si la base d'utilisateurs grandit.

---

## 5. Modele recommande

- **Option A - SSO YunoHost natif (recommandee maintenant).** Statu quo
  ameliore : on garde `Remote-User`, on durcit le binding Node (127.0.0.1), on
  declare `/partage/` public, on documente la matrice ci-dessus. Zero code a
  ajouter.

- **Option B - adosser a Authentik (cible si A la source rejoint le SSO commun
  PIAF).** Unifie l'identite avec les autres outils, au prix d'un couplage et
  d'un travail d'integration (delegation OIDC cote YunoHost, ou OIDC direct
  cote appli). A decider au point commun.

Decision a prendre avec Guillaume. Tant qu'A la source reste autonome sur son
YunoHost, l'Option A suffit.
