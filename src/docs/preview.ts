import { h, onMount, type Component } from '@/ui/dom/h'

/**
 * Les balises `<mochi-bot ...></mochi-bot>` d'un exemple de code, TELLES QU'ECRITES dans l'exemple (attributs compris).
 * La page docs les insere telles quelles : le Mochi affiche a cote du code est donc celui que le code produit.
 */
export function tagsOf(example: string): string[] {
  return [...example.matchAll(/<mochi-bot\b[\s\S]*?><\/mochi-bot>/g)].map((m) => m[0])
}

export interface PreviewProps {
  /** l'exemple de code (HTML) dont on montre le resultat */
  example: string
  /** legende sous le resultat */
  caption?: string
}

/** Le resultat VIVANT d'un exemple : ses balises inserees telles quelles, le composant charge par l'entree publique. */
export const Preview: Component<PreviewProps> = (props) => {
  // la balise n'est declaree qu'une fois la bibliotheque chargee : les elements deja poses se mettent a jour seuls
  onMount(() => {
    import('mochi-world').catch(() => {})
  })
  return () =>
    h(
      'figure',
      { class: 'doc-preview' },
      h('div', { class: 'doc-preview-bots', 'data-example': '', innerHTML: tagsOf(props.example).join('') }),
      props.caption ? h('figcaption', null, props.caption) : null
    )
}
