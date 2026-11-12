import { h, onMount, type Component } from '@/ui/dom/h'

/**
 * The `<mochi-bot ...></mochi-bot>` tags of a code example, AS WRITTEN in the example (attributes included). The docs
 * page inserts them as is: the Mochi shown next to the code is therefore the one the code produces.
 */
export function tagsOf(example: string): string[] {
  return [...example.matchAll(/<mochi-bot\b[\s\S]*?><\/mochi-bot>/g)].map((m) => m[0])
}

export interface PreviewProps {
  /** the code example (HTML) whose result is shown */
  example: string
  /** caption under the result */
  caption?: string
}

/**
 * The LIVE result of an example: its tags inserted as is, the component loaded through the public entry.
 */
export const Preview: Component<PreviewProps> = (props) => {
  // the tag is only declared once the library is loaded: elements already placed update by themselves
  onMount(() => {
    import('mochiz-world').catch(() => {})
  })
  return () =>
    h(
      'figure',
      { class: 'doc-preview' },
      h('div', { class: 'doc-preview-bots', 'data-example': '', innerHTML: tagsOf(props.example).join('') }),
      props.caption ? h('figcaption', null, props.caption) : null
    )
}
