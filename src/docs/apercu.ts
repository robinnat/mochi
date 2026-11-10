import { h, surMontage, type Composant } from '@/ui/dom/h'

/**
 * Les balises `<mochi-bot ...></mochi-bot>` d'un exemple de code, TELLES QU'ECRITES dans l'exemple (attributs compris).
 * La page docs les insere telles quelles : le Mochi affiche a cote du code est donc celui que le code produit.
 */
export function balisesDe(exemple: string): string[] {
  return [...exemple.matchAll(/<mochi-bot\b[\s\S]*?><\/mochi-bot>/g)].map((m) => m[0])
}

export interface ApercuProps {
  /** l'exemple de code (HTML) dont on montre le resultat */
  exemple: string
  /** legende sous le resultat */
  legende?: string
}

/** Le resultat VIVANT d'un exemple : ses balises inserees telles quelles, le composant charge par l'entree publique. */
export const Apercu: Composant<ApercuProps> = (props) => {
  // la balise n'est declaree qu'une fois la bibliotheque chargee : les elements deja poses se mettent a jour seuls
  surMontage(() => {
    import('mochi-world').catch(() => {})
  })
  return () =>
    h(
      'figure',
      { class: 'doc-apercu' },
      h('div', { class: 'doc-apercu-bots', 'data-exemple': '', innerHTML: balisesDe(props.exemple).join('') }),
      props.legende ? h('figcaption', null, props.legende) : null
    )
}
