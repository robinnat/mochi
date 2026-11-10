import { ref, type Ref } from '@/ui/dom/reactif'
import { h, type Enfant } from '@/ui/dom/h'
import { useModalDialog } from '@/ui/useModalDialog'

/** Classes communes aux boites ; l'animation vient de `styles.css` (`.dialogue`, avec `@starting-style`). */
export const CLASSE_DIALOGUE = 'dialogue m-auto w-80 rounded-2xl bg-white p-5 text-[var(--ink)] shadow-xl'
export const BOUTON_SECONDAIRE = 'h-8 cursor-pointer rounded-lg px-3 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]'
export const BOUTON_PRINCIPAL = 'h-8 cursor-pointer rounded-lg bg-[var(--ink)] px-3 text-xs text-[var(--paper)] transition hover:opacity-90 active:scale-95'

/**
 * Un `<dialog>` modal natif pilote par `open` : renvoie l'element (ref) et la fonction qui le dessine. La fermeture
 * native (Echap, `close`) revient au booleen ; `annuler` decide de ce que fait Echap.
 */
export function boiteModale(open: Ref<boolean>) {
  const el = ref<HTMLDialogElement | null>(null)
  useModalDialog(open, el)
  const dessiner = (props: Record<string, unknown>, annuler: () => void, ...enfants: Enfant[]) =>
    h(
      'dialog',
      {
        ...props,
        ref: (e: Element | null) => (el.value = e as HTMLDialogElement | null),
        class: CLASSE_DIALOGUE,
        onClose: () => (open.value = false),
        onCancel: (e: Event) => {
          e.preventDefault()
          annuler()
        }
      },
      enfants
    )
  return { el, dessiner }
}
