import { Request, Response, NextFunction } from 'express'
import db from './db.js'

export interface AuthUser {
  id: number
  nom: string
  role: 'membre' | 'animateur' | 'admin'
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // YunoHost SSO: Remote-User header
  const remoteUser = req.headers['remote-user'] as string | undefined
  // Dev fallback: query param or default
  const username = remoteUser || (req.query._user as string) || 'HydroLooney'

  const row = db.prepare(
    'SELECT id, nom, role FROM utilisateurs WHERE nom = ? AND actif = 1'
  ).get(username) as AuthUser | undefined

  if (row) {
    req.user = row
  } else {
    // Auto-create user on first login (YNH SSO)
    const result = db.prepare(
      'INSERT OR IGNORE INTO utilisateurs (nom) VALUES (?)'
    ).run(username)
    if (result.changes > 0) {
      req.user = { id: Number(result.lastInsertRowid), nom: username, role: 'membre' }
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
