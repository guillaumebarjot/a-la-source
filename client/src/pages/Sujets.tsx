import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import SourceImage from '../components/cards/SourceImage'
import type { Sujet, Atelier } from '../types'
import '../styles/sujets-accueil.css'

/**
 * Accueil « mix vivant » d'À la source.
 *
 * Pas un simple annuaire : la page montre d'emblée la dimension éducation
 * populaire aux médias. Trois temps :
 *   1. un bandeau d'intro (ateliers, débunkage collectif, veille partagée) ;
 *   2. la une, dernier décryptage à chaud s'il existe (sinon ignoré) ;
 *   3. l'activité récente (derniers débunkages et ateliers) en cartes compactes ;
 *   4. les sujets suivis, grille de cartes-thèmes (inchangée).
 *
 * Robustesse : toute API en échec ou vide donne un état vide discret, jamais
 * d'erreur bloquante.
 */

// Forme minimale renvoyée par GET /debunkages (typée localement, sans toucher
// à types/index.ts).
interface DebunkageListe {
  id: number
  titre: string
  statut_activite: string | null
  statut: string | null
  relaye_site: number | null
  sujet_id: number | null
  sujet_titre: string | null
  sujet_slug: string | null
  nb_posts: number
  nb_sources: number
  cree_le: string
  maj_le: string
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Sujets() {
  const [sujets, setSujets] = useState<Sujet[]>([])
  const [debunkages, setDebunkages] = useState<DebunkageListe[]>([])
  const [ateliers, setAteliers] = useState<Atelier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Chaque appel est isolé : un échec ne casse pas le reste de l'accueil.
    const pSujets = api.get<Sujet[]>('/sujets?statut=publie').catch(() => [] as Sujet[])
    const pDeb = api.get<DebunkageListe[]>('/debunkages').catch(() => [] as DebunkageListe[])
    const pAteliers = api.get<Atelier[]>('/ateliers').catch(() => [] as Atelier[])

    Promise.all([pSujets, pDeb, pAteliers])
      .then(([s, d, a]) => {
        setSujets(Array.isArray(s) ? s : [])
        setDebunkages(Array.isArray(d) ? d : [])
        setAteliers(Array.isArray(a) ? a : [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Chargement de l'accueil...</div>

  // La une : dernier débunkage publié si possible, sinon le plus récemment
  // actif. Ignoré proprement si aucun débunkage.
  const une = debunkages.find((d) => d.statut === 'publie' || d.relaye_site === 1) ?? debunkages[0] ?? null

  // Activité récente : derniers débunkages (hors la une) + derniers ateliers,
  // limités pour rester compacts.
  const debRecents = debunkages.filter((d) => d.id !== une?.id).slice(0, 4)
  const ateliersRecents = [...ateliers]
    .sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0))
    .slice(0, 4)
  const aDeLActivite = debRecents.length > 0 || ateliersRecents.length > 0

  const statutAtelierLabel: Record<Atelier['statut'], string> = {
    preparation: 'En préparation',
    pret: 'Prêt',
    en_cours: 'En cours',
    termine: 'Terminé',
  }

  return (
    <div className="sujets-page">
      {/* 1. Bandeau d'intro */}
      <header className="accueil-intro">
        <h1>À la source</h1>
        <p className="accueil-intro-baseline">
          L'éducation populaire aux médias, en commun. On apprend à remonter à la
          source de l'information, à démonter ensemble une affirmation trompeuse,
          et à garder l'œil sur ce qui se publie.
        </p>
        <ul className="accueil-intro-piliers">
          <li><strong>Ateliers</strong> pour décrypter à plusieurs</li>
          <li><strong>Débunkage collectif</strong> des affirmations virales</li>
          <li><strong>Veille partagée</strong> sur les sujets qu'on suit</li>
        </ul>
      </header>

      {/* 2. La une : dernier décryptage à chaud */}
      {une && (
        <section className="accueil-section">
          <h2 className="accueil-section-titre">À la une</h2>
          <Link to={`/debunkages/${une.id}`} className="accueil-une">
            <span className="accueil-une-kicker">Dernier décryptage à chaud</span>
            <p className="accueil-une-titre">{une.titre}</p>
            <div className="accueil-une-meta">
              {une.sujet_titre && (
                <span className="accueil-une-sujet">{une.sujet_titre}</span>
              )}
              {une.nb_sources > 0 && (
                <span>{une.nb_sources} source{une.nb_sources > 1 ? 's' : ''}</span>
              )}
              {une.nb_posts > 0 && (
                <span>{une.nb_posts} post{une.nb_posts > 1 ? 's' : ''} publié{une.nb_posts > 1 ? 's' : ''}</span>
              )}
              {formatDate(une.maj_le) && <span>maj. {formatDate(une.maj_le)}</span>}
            </div>
          </Link>
        </section>
      )}

      {/* 3. Activité récente */}
      <section className="accueil-section">
        <h2 className="accueil-section-titre">
          Activité récente
          <Link to="/debunkages" className="accueil-section-lien">Tous les débunkages</Link>
        </h2>
        {!aDeLActivite ? (
          <p className="accueil-empty">Rien de récent pour l'instant. Ça arrive bientôt.</p>
        ) : (
          <ul className="accueil-activite-liste">
            {debRecents.map((d) => (
              <li key={`deb-${d.id}`}>
                <Link to={`/debunkages/${d.id}`} className="accueil-activite-carte">
                  <span className="accueil-activite-type">Débunkage</span>
                  <span className="accueil-activite-titre">{d.titre}</span>
                  <span className="accueil-activite-meta">
                    {d.sujet_titre && <span>{d.sujet_titre}</span>}
                    {d.nb_sources > 0 && (
                      <span>{d.nb_sources} source{d.nb_sources > 1 ? 's' : ''}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {ateliersRecents.map((a) => (
              <li key={`atelier-${a.id}`}>
                <Link to="/ateliers" className="accueil-activite-carte">
                  <span className="accueil-activite-type">Atelier</span>
                  <span className="accueil-activite-titre">Atelier nº {a.numero}</span>
                  <span className="accueil-activite-meta">
                    <span>{statutAtelierLabel[a.statut] ?? a.statut}</span>
                    {formatDate(a.date_atelier) && <span>{formatDate(a.date_atelier)}</span>}
                    {a.lieu && <span>{a.lieu}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Les sujets suivis (grille de cartes-thèmes, inchangée) */}
      <section className="accueil-section">
        <h2 className="accueil-section-titre">Sujets</h2>
        {sujets.length === 0 ? (
          <p className="accueil-empty">Aucun sujet publié pour l'instant.</p>
        ) : (
          <div className="sujets-grid">
            {sujets.map((s) => (
              <Link key={s.id} to={`/sujets/${s.slug}`} className="sujet-card">
                <div
                  className="sujet-card-visuel"
                  style={s.couleur ? { background: s.couleur } : undefined}
                >
                  <SourceImage
                    src={s.image_url}
                    fallback={<span className="sujet-card-initiale">{s.titre.charAt(0)}</span>}
                  />
                </div>
                <div className="sujet-card-body">
                  <h3 className="sujet-card-titre">{s.titre}</h3>
                  {s.accroche && <p className="sujet-card-accroche">{s.accroche}</p>}
                  <div className="sujet-card-meta">
                    <span>{s.nb_sources ?? 0} source{(s.nb_sources ?? 0) > 1 ? 's' : ''}</span>
                    <span>{s.nb_evenements ?? 0} événement{(s.nb_evenements ?? 0) > 1 ? 's' : ''}</span>
                    {s.provenance && <span className="sujet-card-provenance">{s.provenance}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
