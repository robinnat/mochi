import { ref } from 'vue'
import type { RenduId } from '@/ui/rendu'

/** Style 3D choisi sur le site (section 3D et playground) : Soft, Flat ou Pixel. */
export const STYLES_SITE: { id: RenduId; label: string }[] = [
  { id: '3d', label: 'Soft' },
  { id: 'flat3d', label: 'Flat' },
  { id: 'pixel3d', label: 'Pixel' }
]
export const styleSite = ref<RenduId>('3d')
