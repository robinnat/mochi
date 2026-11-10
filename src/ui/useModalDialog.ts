import { watch, type Ref } from '@/ui/dom/reactive'
import { onUnmount } from '@/ui/dom/h'

/**
 * Pilote un `<dialog>` natif ouvert en modal depuis un booleen.
 *
 * On passe par l'element natif plutot que par une div : le navigateur fournit
 * alors le piege a focus, la fermeture par Echap, le retour du focus au
 * declencheur, l'inertie du reste de la page et le fond assombri.
 *
 * L'element vient de l'appelant (une `ref` remplie par la fonction `ref` de son
 * dessin). Cote dessin, il reste a renvoyer la fermeture native vers le booleen :
 * `onClose: () => (open = false)`, `onCancel: (e) => { e.preventDefault(); open = false }`.
 */
export function useModalDialog(open: Ref<boolean>, el: Ref<HTMLDialogElement | null>) {
  watch(open, (on) => {
    const dialog = el.value
    if (!dialog) return
    if (on) dialog.showModal()
    else if (dialog.open) dialog.close()
  })

  // le composant peut disparaitre alors que la boite est ouverte (changement
  // d'onglet) : un `<dialog>` laisse en modal bloquerait la page entiere
  onUnmount(() => {
    if (el.value?.open) el.value.close()
  })
}
