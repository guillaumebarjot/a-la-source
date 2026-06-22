import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SubmitSource from './SubmitSource'

interface Props {
  /** Appele apres creation. Defaut : aller a l'Inbox, la ou on qualifie. */
  onCreated?: () => void
  label?: string
  className?: string
}

/**
 * Bouton + modale « Ajouter une source », reutilisable et global. Jusqu'ici le
 * seul point d'entree etait enfoui en haut de la Veille ; on le rend disponible
 * partout (Header) et la ou on qualifie (Inbox). SubmitSource se ferme seul
 * apres creation ; on enchaine alors vers la qualification.
 */
export default function AjouterSource({ onCreated, label = 'Source', className = 'btn-ajouter-source' }: Props) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const handleCreated = () => { if (onCreated) onCreated(); else navigate('/inbox') }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={className} title="Ajouter une source">
          <Plus size={15} /> {label}
        </button>
      </Dialog.Trigger>
      <SubmitSource open={open} onOpenChange={setOpen} onCreated={handleCreated} />
    </Dialog.Root>
  )
}
