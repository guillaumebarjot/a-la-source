import express from 'express'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { authMiddleware } from './lib/auth.js'
import { autoMigrate } from './db/auto-migrate.js'
import sourcesRouter from './routes/sources.js'
import tagsRouter from './routes/tags.js'
import evaluationsRouter from './routes/evaluations.js'
import commentairesRouter from './routes/commentaires.js'
import mediasRouter from './routes/medias.js'
import ateliersRouter from './routes/ateliers.js'
import authRouter from './routes/auth.js'
import mecanismesRouter from './routes/mecanismes.js'
import evenementsRouter from './routes/evenements.js'
import sujetsRouter from './routes/sujets.js'
import contenusRouter from './routes/contenus.js'
import parametresRouter from './routes/parametres.js'
import rechercheRouter from './routes/recherche.js'
import becsrougesRouter from './routes/becsrouges.js'
import debunkagesRouter from './routes/debunkages.js'
import parcoursRouter from './routes/parcours.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3031', 10)

// Met le schéma à jour au démarrage (idempotent, sûr si déjà appliqué)
autoMigrate()

const app = express()

app.use(express.json())
app.use(authMiddleware)

// Static files: uploads and images
const uploadsDir = join(__dirname, '..', '..', 'uploads')
const imagesDir = join(__dirname, '..', '..', 'db', 'image-cache')
app.use('/uploads', express.static(uploadsDir))
app.use('/images', express.static(imagesDir))

// API routes
app.use('/api/sources', sourcesRouter)
app.use('/api/tags', tagsRouter)
app.use('/api/evaluations', evaluationsRouter)
app.use('/api/commentaires', commentairesRouter)
app.use('/api/medias', mediasRouter)
app.use('/api/ateliers', ateliersRouter)
app.use('/api/auth', authRouter)
app.use('/api/mecanismes', mecanismesRouter)
app.use('/api/evenements', evenementsRouter)
app.use('/api/sujets', sujetsRouter)
app.use('/api/contenus', contenusRouter)
app.use('/api/parametres', parametresRouter)
app.use('/api/recherche', rechercheRouter)
app.use('/api/becs-rouges', becsrougesRouter)
app.use('/api/debunkages', debunkagesRouter)
app.use('/api/parcours', parcoursRouter)

// Serve React build in production
const clientDist = join(__dirname, '..', '..', 'client', 'dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`A la source v2 — http://localhost:${PORT}`)
})
