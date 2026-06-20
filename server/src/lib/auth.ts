import { Request, Response, NextFunction } from 'express'
import db from './db.js'

export type Role = 'membre' | 'animateur' | 'admin'

export interface AuthUser {
  id: number
  nom: string
  role: Role
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

// Hierarchie des roles : un palier plus haut inclut les droits des paliers du dessous.
const RANG: Record<Role, number> = { membre: 0, animateur: 1, admin: 2 }

function plusHaut(a: Role, b: Role): Role {
  return RANG[a] >= RANG[b] ? a : b
}

// Identite : en prod, derriere Authentik forward-auth, NPM transmet l'identite reelle
// dans X-authentik-username. On garde Remote-User (ancien SSO YunoHost) en repli, puis
// le parametre ?_user en developpement uniquement.
function lireIdentite(req: Request): string | undefined {
  const authentik = req.headers['x-authentik-username'] as string | undefined
  if (authentik) return authentik
  const remoteUser = req.headers['remote-user'] as string | undefined
  if (remoteUser) return remoteUser
  if (process.env.NODE_ENV !== 'production') {
    return (req.query._user as string) || 'HydroLooney'
  }
  return undefined
}

// Role issu du SSO. On le derive des groupes Authentik reels (X-authentik-groups,
// separateur | ou ,), poses par NPM depuis la sous-requete d'auth (anti-usurpation).
// Un en-tete x-alasource-role explicite, s'il est pose, a la priorite.
// Groupes PIAF : admins / sso-admins (superuser Guillaume), rc-admins (admins Rouge
// Coquelicot) ouvrent le role admin ; rc-membres et les autres entrent en membre.
// Le role animateur n'est pas porte par un groupe : il s'attribue dans l'app (un
// admin promeut un membre via PATCH /api/auth/users/:id).
function roleDepuisSso(req: Request): Role {
  const headerRole = (req.headers['x-alasource-role'] as string | undefined)?.trim()
  if (headerRole === 'admin' || headerRole === 'animateur' || headerRole === 'membre') {
    return headerRole
  }
  const brut = (req.headers['x-authentik-groups'] as string | undefined) || ''
  const groupes = brut.split(/[|,]/).map((g) => g.trim().toLowerCase()).filter(Boolean)
  if (groupes.some((g) => g === 'admins' || g === 'sso-admins' || g === 'rc-admins')) {
    return 'admin'
  }
  return 'membre'
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const username = lireIdentite(req)
  if (!username) {
    next()
    return
  }

  const ssoRole = roleDepuisSso(req)

  const row = db.prepare(
    'SELECT id, nom, role FROM utilisateurs WHERE nom = ? AND actif = 1'
  ).get(username) as AuthUser | undefined

  if (row) {
    // Le role applicatif (modifiable en base par un admin, ex. promotion en animateur)
    // ne peut pas descendre sous celui que le SSO accorde : Guillaume (groupe admins)
    // reste admin quoi qu'il arrive, et un membre promu animateur le reste.
    req.user = { ...row, role: plusHaut(row.role, ssoRole) }
  } else {
    // Auto-creation au premier passage SSO, avec le role accorde par les groupes.
    const result = db.prepare(
      'INSERT OR IGNORE INTO utilisateurs (nom, role) VALUES (?, ?)'
    ).run(username, ssoRole)
    if (result.changes > 0) {
      req.user = { id: Number(result.lastInsertRowid), nom: username, role: ssoRole }
    } else {
      const again = db.prepare(
        'SELECT id, nom, role FROM utilisateurs WHERE nom = ? AND actif = 1'
      ).get(username) as AuthUser | undefined
      if (again) req.user = { ...again, role: plusHaut(again.role, ssoRole) }
    }
  }

  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acces refuse' })
      return
    }
    next()
  }
}
