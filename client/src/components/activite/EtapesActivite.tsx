import { Check, Circle, ArrowRight } from 'lucide-react'
import '../../styles/etapes-activite.css'

/**
 * EtapesActivite — barre d'etapes (stepper) + encart « Prochaine action »
 * commun a toutes les activites d'A la source (dossier, debunkage, atelier,
 * arpentage). Chantier #1, livrable B.
 *
 * Posture (note de tunnelisation, R epoche) :
 *  - Les jalons sont des FAITS calcules cote serveur (presence d'une donnee),
 *    jamais un score ni un verdict de qualite.
 *  - Aucun jalon n'est bloquant : c'est un fil conducteur, pas un rail. On peut
 *    publier (ou avancer) meme si des etapes ne sont pas « allumees ».
 *  - L'encart « Prochaine action » pointe le PREMIER jalon non franchi, avec une
 *    invitation douce et, si fourni, un bouton qui mene au bon endroit.
 *
 * Le composant ne sait rien du metier : on le parametre par une liste ordonnee
 * d'etapes { cle, label, fait, action? }. Chaque page construit cette liste a
 * partir des booleens `jalons` renvoyes par son endpoint de detail.
 */

export interface Etape {
  cle: string
  /** Libelle court de l'etape (ex. « Mise en perspective »). */
  label: string
  /** Jalon franchi ? Booleen factuel issu du serveur. */
  fait: boolean
  /** Invitation affichee dans l'encart si c'est la prochaine action. */
  invitation?: string
  /** Bouton optionnel de l'encart : un libelle + un handler (scroll, focus...). */
  action?: { libelle: string; onClick: () => void }
}

export default function EtapesActivite({
  etapes,
  titreFin = 'Tout est en place. Vous pouvez avancer quand vous le souhaitez.',
}: {
  etapes: Etape[]
  /** Message de l'encart quand tous les jalons sont franchis. */
  titreFin?: string
}) {
  // Premier jalon non franchi = prochaine action (souple : informatif, pas un rail).
  const prochaine = etapes.find((e) => !e.fait) ?? null
  const nbFaits = etapes.filter((e) => e.fait).length

  return (
    <div className="etapes-activite" aria-label="Etapes de l'activite">
      <ol className="etapes-barre">
        {etapes.map((e, i) => {
          const estProchaine = prochaine?.cle === e.cle
          let cls = 'etapes-pas'
          if (e.fait) cls += ' etapes-pas--fait'
          if (estProchaine) cls += ' etapes-pas--courant'
          return (
            <li key={e.cle} className={cls}>
              <span className="etapes-pas-puce" aria-hidden="true">
                {e.fait ? <Check size={14} /> : <Circle size={10} />}
              </span>
              <span className="etapes-pas-label">{e.label}</span>
              {i < etapes.length - 1 && <span className="etapes-pas-trait" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>

      <div className="etapes-prochaine">
        {prochaine ? (
          <>
            <span className="etapes-prochaine-libelle">
              <ArrowRight size={15} aria-hidden="true" />
              Prochaine action :{' '}
              <strong>{prochaine.invitation ?? prochaine.label}</strong>
            </span>
            {prochaine.action && (
              <button
                type="button"
                className="etapes-prochaine-btn"
                onClick={prochaine.action.onClick}
              >
                {prochaine.action.libelle}
              </button>
            )}
          </>
        ) : (
          <span className="etapes-prochaine-libelle etapes-prochaine-libelle--fin">
            <Check size={15} aria-hidden="true" /> {titreFin}
          </span>
        )}
        <span className="etapes-prochaine-compte">{nbFaits}/{etapes.length}</span>
      </div>
    </div>
  )
}
