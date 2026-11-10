import type { RenduId } from '@/ui/rendu'

/** Les trois styles 3D montres sur le site, dans l'ordre du site : Soft, Pixel et Flat. */
export const STYLES_SITE: { id: RenduId; label: string }[] = [
  { id: '3d', label: 'Soft' },
  { id: 'pixel3d', label: 'Pixel' },
  { id: 'flat3d', label: 'Flat' }
]
