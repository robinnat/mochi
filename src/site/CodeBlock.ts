import { computed, ref } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { surligner } from './code'

/** Bloc de code colore, avec un titre (nom de fichier ou langage) et un bouton Copier. */
export interface CodeBlockProps {
  code: string
  titre?: string
}

export const CodeBlock: Composant<CodeBlockProps> = (props) => {
  const html = computed(() => surligner(props.code))
  const copie = ref(false)
  let minuteur = 0
  async function copier() {
    try {
      await navigator.clipboard.writeText(props.code)
      copie.value = true
      clearTimeout(minuteur)
      minuteur = window.setTimeout(() => (copie.value = false), 1600)
    } catch {
      // presse-papiers refuse : le texte reste selectionnable
    }
  }
  return () =>
    h(
      'div',
      { class: 'cb' },
      h(
        'div',
        { class: 'cb-tete' },
        h('span', { class: 'cb-titre' }, props.titre ?? ''),
        h(
          'button',
          { type: 'button', class: ['cb-copier', { ok: copie.value }], onClick: copier },
          h(
            'svg',
            { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true' },
            !copie.value
              ? h('path', {
                  key: 'c',
                  d: 'M5 5V3.5A1.5 1.5 0 0 1 6.5 2h6A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H11M3.5 5h6A1.5 1.5 0 0 1 11 6.5v6A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-6A1.5 1.5 0 0 1 3.5 5Z',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '1.4'
                })
              : h('path', { key: 'ok', d: 'M3 8.5 6.5 12 13 4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
          ),
          h('span', null, copie.value ? 'Copied' : 'Copy')
        )
      ),
      // le code est TOUJOURS echappe par `surligner` avant d'etre enveloppe
      h('pre', { class: 'cb-code' }, h('code', { innerHTML: html.value }))
    )
}
