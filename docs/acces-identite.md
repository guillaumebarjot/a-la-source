# Accès, utilisateurs et identité — « À la source »

Comment l'application authentifie, gère les utilisateurs et les droits. État
réel au 11/06/2026 (vérifié dans le code et la base), puis modèle recommandé.

## 1. Authentification : Authentik forward-auth (PIAF)

En production (Bomp4rd, `alasource.rouge-coquelicot.fr`), l'application est servie derrière
**Authentik** (SSO de l'infra PIAF, en forward-auth via NPM). L'app ne gère
**aucun mot de passe** : NPM interroge Authentik et transmet l'identité et les
groupes dans des en-têtes posés par la sous-requête d'auth (anti-usurpation : NPM
écrase toute valeur envoyée par le client). Le middleware `authMiddleware`
(`server/src/lib/auth.ts`) :

1. lit l'identité dans `X-authentik-username` (repli `Remote-User` pour l'ancien
   SSO YunoHost, puis `?_user=` en dev) ;
2. dérive un rôle plancher des groupes (`X-authentik-groups`) : `admins`,
   `sso-admins`, `rc-admins` ouvrent `admin` ; tout autre compte ayant franchi le
   forward-auth entre `membre` ;
3. cherche l'utilisateur en base (`utilisateurs.nom`, si `actif = 1`) ; s'il est
   inconnu, **crée** un compte avec le rôle accordé (auto-provisioning) ;
4. attache `req.user = { id, nom, role }`, le rôle effectif étant le **plus haut**
   entre le rôle en base (qu'un admin peut élever, ex. `animateur`) et le rôle SSO.

Groupes Authentik autorisés à l'accès (bindings du blueprint `alasource`) :
`rc-membres`, `rc-admins`, `piafs`, `admins`. Le vrai groupe des membres Rouge
Coquelicot est `rc-membres`.

### Développement

Hors production (`NODE_ENV !== 'production'`), l'utilisateur par défaut est
`HydroLooney`, surchargeables par `?_user=Nom` dans l'URL. Ce fallback est
strictement réservé au dev : il ne doit jamais pouvoir s'activer en prod.

### Routes publiques

Les pages de partage `/partage/*` (OpenGraph pour Discord) sont conçues pour être
publiques. Tant que **tout est gardé derrière le SSO** (choix initial du
déploiement PIAF), elles le sont aussi. Pour les rouvrir (aperçus de liens dans
Discord), ajouter une exception sans auth sur `/partage/` dans l'hôte NPM
(équivalent des `skipped_uris` de l'ancien déploiement YunoHost).

---

## 2. Rôles

La base définit trois rôles (CHECK dans `schema.sql`) :

| Rôle (valeur technique) | Étiquette affichée | Sens |
|---|---|---|
| `membre` | Membre | participe : soumet, commente, évalue, identifie, crée des activités |
| `animateur` | Facilitateur·ice | anime : gère les ateliers, publie les sujets |
| `admin` | Admin | administre : paramètres, utilisateurs, suppression |

> Note de vocabulaire : la **valeur en base et en code est `animateur`**.
> L'interface et la documentation parlent de « facilitateur·ice ». C'est le
> même rôle. Ne pas introduire de valeur `facilitateur` en base.

Les gardes côté serveur utilisent `requireRole(...)` ; l'admin gère les rôles
via `PATCH /api/auth/users/:id`.

### Population réelle (base de dev, 11/06/2026)

Trois comptes : `HydroLooney` (admin), `JonLuk` (membre), `Aurelie` (membre).
Aucun compte `animateur` à ce jour : les routes réservées `animateur`/`admin`
ne sont donc accessibles qu'à l'admin tant qu'aucun facilitateur n'est promu.

---

## 3. Matrice « qui voit / fait quoi »

Établie depuis les `requireRole(...)` réels du code.

| Capacité | Public | membre | animateur | admin |
|---|---|---|---|---|
| Pages `/partage/*` (objets publiés) | oui | oui | oui | oui |
| Lire veille / sujets / sources | non | oui | oui | oui |
| Soumettre, commenter, évaluer, identifier mécanisme | non | oui | oui | oui |
| Marquer lu / recommander | non | oui | oui | oui |
| Créer une activité (dossier, débunk, arpentage, parcours) | non | oui | oui | oui |
| Gérer les ateliers (créer, sources, synthèse, éditer) | non | non | oui | oui |
| Publier un sujet | non | non | oui | oui |
| Supprimer une source | non | non | oui | oui |
| Modifier les paramètres globaux | non | non | non | oui |
| Gérer utilisateurs et rôles | non | non | non | oui |

---

## 4. Risques et durcissement

1. **Confiance dans les en-têtes d'identité.** Les en-têtes `X-authentik-*` (et
   le repli `Remote-User`) ne sont fiables que parce que **NPM les pose lui-même**
   après la sous-requête forward-auth et **écrase toute valeur envoyée par le
   client**. Le conteneur ne doit être joignable **que** via NPM (réseau Docker
   `web`, jamais exposé en direct), sans quoi un en-tête forcé usurperait une
   identité. Le repli `?_user=` est strictement réservé au dev (`NODE_ENV !==
   'production'`).

2. **Base de travail sur OneDrive ARTELIA (compte professionnel).** Les données
   de l'association vivent, en dev, sur l'espace cloud d'un employeur
   (`server/src/db/dbPath.ts`). C'est un risque de gouvernance et de confidentialité.
   - En **prod**, la base est LOCALE au serveur (volume `/data`, via
     `A_LA_SOURCE_DB`), jamais OneDrive.
   - OneDrive = poste de dev de Guillaume uniquement. À clarifier et, à terme,
     à sortir d'un espace professionnel.

3. **Pas de journal d'attribution de rôle.** Acceptable à quelques comptes ; à
   prévoir si la base d'utilisateurs grandit.

---

## 5. Modèle en place : Authentik forward-auth (PIAF)

L'application est adossée au **SSO commun Authentik** de l'infra PIAF, en
forward-auth via NPM (cf. section 1 et `docs/deploiement.md`). L'identité est
unifiée avec les autres outils de l'infra, sans mot de passe à gérer côté app.

- **Accès** gouverné par les bindings du blueprint Authentik `alasource` :
  groupes `rc-membres`, `rc-admins`, `piafs`, `admins` autorisés à franchir le
  forward-auth.
- **Rôles** dérivés des groupes : `admins` / `sso-admins` / `rc-admins` ouvrent
  `admin` ; tout autre compte ayant franchi le SSO entre `membre`. Le rôle en
  base peut **élever** un compte (ex. `animateur`), jamais l'abaisser : le rôle
  effectif est le plus haut des deux. Le rôle `animateur` est donc attribué **en
  base** (par un admin, via `PATCH /api/auth/users/:id`).
- **Repli** : `Remote-User` (compatibilité ancien SSO) puis `?_user=Nom` en dev
  uniquement.
- **Pages `/partage/*`** : publiques par conception (OpenGraph). Pour les rouvrir
  sans SSO, déclarer une exception sur `/partage/` dans l'hôte NPM.
