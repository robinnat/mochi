import { h, type Composant } from '@/ui/dom/h'
import { urlAffiche } from './affiches'
import { themeEffectif } from './theme'

/** Un Mochi fige, en image pre-rendue de la vraie 3D (`public/rendus/`), dans le theme de la page. */
export interface AfficheProps {
  nom: string
  taille: number
  alt?: string
  eager?: boolean
}

export const Affiche: Composant<AfficheProps> = (props) => () =>
  h('img', {
    class: 'affiche',
    src: urlAffiche(props.nom, themeEffectif.value),
    width: props.taille,
    height: props.taille,
    alt: props.alt ?? '',
    loading: props.eager ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false'
  })
