import { watch, type Ref } from '@/ui/dom/reactive'
import { onUnmount } from '@/ui/dom/h'

/**
 * Drives a native `<dialog>` opened as modal from a boolean.
 *
 * We use the native element rather than a div: the browser then provides the focus trap, closing with Escape, focus
 * going back to the trigger, the inertness of the rest of the page and the dimmed backdrop.
 *
 * The element comes from the caller (a `ref` filled by the `ref` function of its drawing). On the drawing side, the
 * native close must go back to the boolean: `onClose: () => (open = false)`, `onCancel: (e) => { e.preventDefault();
 * open = false }`.
 */
export function useModalDialog(open: Ref<boolean>, el: Ref<HTMLDialogElement | null>) {
  watch(open, (on) => {
    const dialog = el.value
    if (!dialog) return
    if (on) dialog.showModal()
    else if (dialog.open) dialog.close()
  })

  // the component can disappear while the dialog is open (tab
  // change): a `<dialog>` left modal would block the whole page
  onUnmount(() => {
    if (el.value?.open) el.value.close()
  })
}
