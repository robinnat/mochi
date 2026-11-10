import { computed, ref } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { highlight } from './code'

/** Highlighted code block, with a title (file name or language) and a Copy button. */
export interface CodeBlockProps {
  code: string
  title?: string
}

export const CodeBlock: Component<CodeBlockProps> = (props) => {
  const html = computed(() => highlight(props.code))
  const copy = ref(false)
  let timer = 0
  async function copier() {
    try {
      await navigator.clipboard.writeText(props.code)
      copy.value = true
      clearTimeout(timer)
      timer = window.setTimeout(() => (copy.value = false), 1600)
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
        { class: 'cb-head' },
        h('span', { class: 'cb-title' }, props.title ?? ''),
        h(
          'button',
          { type: 'button', class: ['cb-copier', { ok: copy.value }], onClick: copier },
          h(
            'svg',
            { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true' },
            !copy.value
              ? h('path', {
                  key: 'c',
                  d: 'M5 5V3.5A1.5 1.5 0 0 1 6.5 2h6A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H11M3.5 5h6A1.5 1.5 0 0 1 11 6.5v6A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-6A1.5 1.5 0 0 1 3.5 5Z',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '1.4'
                })
              : h('path', { key: 'ok', d: 'M3 8.5 6.5 12 13 4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
          ),
          h('span', null, copy.value ? 'Copied' : 'Copy')
        )
      ),
      // the code is ALWAYS escaped by `highlight` before being wrapped
      h('pre', { class: 'cb-code' }, h('code', { innerHTML: html.value }))
    )
}
