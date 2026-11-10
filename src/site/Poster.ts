import { h, type Component } from '@/ui/dom/h'
import { urlPoster } from './posters'
import { effectiveTheme } from './theme'

/** A frozen Mochi, as a pre-rendered image of the real 3D (`public/renders/`), in the page's theme. */
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
