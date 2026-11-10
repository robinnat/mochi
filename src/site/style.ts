import type { RenderStyleId } from 'mochis/catalog'

/** The three 3D styles shown on the site, in the site's order: Soft, Pixel and Flat. */
export const STYLES_SITE: { id: RenderStyleId; label: string }[] = [
  { id: '3d', label: 'Soft' },
  { id: 'pixel3d', label: 'Pixel' },
  { id: 'flat3d', label: 'Flat' }
]
