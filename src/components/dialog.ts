import { ref, type Ref } from '@/ui/dom/reactive'
import { h, type Child } from '@/ui/dom/h'
import { useModalDialog } from '@/ui/useModalDialog'

/**
 * Classes shared by dialogs; the animation comes from `styles.css` (`.dialogue`, with `@starting-style`).
 */
export const CLASS_DIALOG = 'dialogue m-auto w-80 rounded-2xl bg-white p-5 text-[var(--ink)] shadow-xl'
export const BUTTON_SECONDARY = 'h-8 cursor-pointer rounded-lg px-3 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]'
export const BUTTON_PRIMARY = 'h-8 cursor-pointer rounded-lg bg-[var(--ink)] px-3 text-xs text-[var(--paper)] transition hover:opacity-90 active:scale-95'

/**
 * A native modal `<dialog>` driven by `open`: returns the element (ref) and the function that draws it. Native
 * closing (Escape, `close`) goes back to the boolean; `cancel` decides what Escape does.
 */
export function boxModal(open: Ref<boolean>) {
  const el = ref<HTMLDialogElement | null>(null)
  useModalDialog(open, el)
  const draw = (props: Record<string, unknown>, cancel: () => void, ...children: Child[]) =>
    h(
      'dialog',
      {
        ...props,
        ref: (e: Element | null) => (el.value = e as HTMLDialogElement | null),
        class: CLASS_DIALOG,
        onClose: () => (open.value = false),
        onCancel: (e: Event) => {
          e.preventDefault()
          cancel()
        }
      },
      children
    )
  return { el, draw }
}
