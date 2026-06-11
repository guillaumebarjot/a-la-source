# Acces, utilisateurs et identite - « A la source »

Comment l'application authentifie, gere les utilisateurs et les droits. Etat
reel au 11/06/2026 (verifie dans le code et la base), puis modele recommande.

---

## 1. Authentification : SSO YunoHost

L'application ne gere **aucun mot de passe**. Elle delegue l'identite a
YunoHost, qui place l'identifiant de l'utilisateur connecte dans le header HTTP
`Remote-User`. Le middleware `authMiddleware` (`server/src/lib/auth.ts`) :

1. lit `Remote-User` ;
2. cherche l'utilisateur en base (`utilisateurs.nom`, si `actif = 1`) ;
3. s'il est inconnu, **cree** un compte avec le role par defaut `membre`
   (auto-provisioning) ;
4. attache `req.user = { id, nom, role }` a la requete.

### Developpement

Hors production (`NODE_ENV !== 'production'`), l'utilisateur par defaut est
`HydroLooney`, surchargeables par `?_user=Nom` dans l'URL. Ce fallback est
strictement reserve au dev : il ne doit jamais pouvoir s'activer en prod.

### Routes publiques

Les pages de partage `/partage/*` (OpenGraph pour Discord) sont volontairement
accessibles sans login. Au deploiement YunoHost, les declarer publiques dans le
SSO (`skipped_uris`), sinon le SSO les intercepte avant l'application.

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
