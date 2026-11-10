import { h, type Component } from '@/ui/dom/h'
import { urlPoster } from './posters'
import { effectiveTheme } from './theme'

/** Un Mochi fige, en image pre-rendue de la vraie 3D (`public/rendus/`), dans le theme de la page. */
export interface PosterProps {
  name: string
  size: number
  alt?: string
  eager?: boolean
}

export const Poster: Component<PosterProps> = (props) => () =>
  h('img', {
    class: 'poster',
    src: urlPoster(props.name, effectiveTheme.value),
    width: props.size,
    height: props.size,
    alt: props.alt ?? '',
    loading: props.eager ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false'
  })
