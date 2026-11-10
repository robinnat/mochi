import { ref } from '@/ui/dom/reactif'
import { THEME_DEFAUT, type Theme } from './theme'

/**
 * Theme par defaut des avatars qui n'ont pas de prop `theme` : le site le pose (clair, sombre ou
 * celui de l'appareil). L'application ne le touche pas, elle reste en clair.
 */
export const themeCourant = ref<Theme>(THEME_DEFAUT)
