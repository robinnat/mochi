import { computed, ref, watch } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { DEFILE, TAILLE_DEFILE, urlAffiche } from './affiches'
import type { Choix, Emplacement } from '@/bot/emplacements'
import { ACCESSOIRES_SITE } from './catalog'
import { useReduit } from './reduced'
import { themeEffectif } from './theme'

/**
 * Carte « accessoires » : une liste fixe de Mochi (corps, couleurs, une piece par emplacement) defile en boucle
 * (environ 1,3 s chacun). Aucune 3D ici : chaque etape est une image pre-rendue de la vraie 3D
 * (`public/rendus/defile-*.webp`), on ne fait que changer d'image. Le minuteur ne tourne que si la carte est a
 * l'ecran et l'onglet visible ; avec `prefers-reduced-motion`, un seul accessoire reste affiche, fixe.
 *
 * Le Mochi qui part s'ecrase puis s'etire vers le haut (`acc-leave-active`) ; le suivant arrive avec un petit
 * « pop » a ressort (`acc-enter-active`). Les deux images se superposent le temps de la transition.
 */
const PAUSE_MS = 1300

const etapes = DEFILE.map((d) => ({
  nom: d.nom,
  label: (Object.entries(d.variante.acc) as [Emplacement, Choix][])
    .map(([e, ch]) => ACCESSOIRES_SITE(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')
}))

export const AccDefile: Composant<Record<string, never>> = () => {
  const reduit = useReduit()
  let racine: HTMLElement | null = null
  let scene: HTMLElement | null = null
  const rang = ref(0)
  let minuteur = 0
  let obs: IntersectionObserver | null = null
  let visible = false

  const courant = computed(() => etapes[reduit.value ? 0 : rang.value % etapes.length]!)
  const src = computed(() => urlAffiche(courant.value.nom, themeEffectif.value))

  /** Charge les images de l'autre etape a l'avance, pour que le changement soit instantane. */
  const prechargees = new Set<string>()
  function precharger() {
    for (const e of etapes) {
      const u = urlAffiche(e.nom, themeEffectif.value)
      if (prechargees.has(u)) continue
      prechargees.add(u)
      const im = new Image()
      im.decoding = 'async'
      im.src = u
    }
  }

  function arreter() {
    if (minuteur) clearInterval(minuteur)
    minuteur = 0
  }
  function demarrer() {
    if (minuteur || reduit.value || !visible || document.hidden) return
    precharger()
    minuteur = window.setInterval(() => (rang.value = (rang.value + 1) % etapes.length), PAUSE_MS)
  }
  const surVisibilite = () => (document.hidden ? arreter() : demarrer())

  /* --------------------------------------------- transition d'image (entree et sortie) */

  function image(): HTMLImageElement {
    const im = document.createElement('img')
    im.className = 'affiche acc-defile-img'
    im.width = TAILLE_DEFILE
    im.height = TAILLE_DEFILE
    im.decoding = 'async'
    im.draggable = false
    majImage(im)
    return im
  }
  function majImage(im: HTMLImageElement) {
    im.src = src.value
    im.alt = `A Mochi wearing: ${courant.value.label}`
  }
  let actuelle: HTMLImageElement | null = null
  /** Classe d'animation posee le temps de l'animation, puis retiree (ou l'element retire) a sa fin. */
  function jouer(el: HTMLElement, classe: string, fin: () => void) {
    el.classList.add(classe)
    let fait = false
    const finir = () => {
      if (fait) return
      fait = true
      el.classList.remove(classe)
      fin()
    }
    el.addEventListener('animationend', finir, { once: true })
    // sans animation (mouvement reduit, image cachee) : pas d'`animationend`
    const duree = parseFloat(getComputedStyle(el).animationDuration || '0') + parseFloat(getComputedStyle(el).animationDelay || '0')
    window.setTimeout(finir, duree > 0 ? duree * 1000 + 60 : 0)
  }
  watch(
    () => courant.value.nom,
    () => {
      if (!scene) return
      const partante = actuelle
      const arrivee = image()
      scene.appendChild(arrivee)
      actuelle = arrivee
      jouer(arrivee, 'acc-enter-active', () => {})
      if (partante) jouer(partante, 'acc-leave-active', () => partante.remove())
    }
  )
  // changement de theme sans changement d'etape : meme image, autre fichier
  watch(src, () => {
    if (actuelle) majImage(actuelle)
  })

  surMontage(() => {
    if (scene && !actuelle) {
      actuelle = image()
      scene.appendChild(actuelle)
    }
    document.addEventListener('visibilitychange', surVisibilite)
    if (typeof IntersectionObserver === 'undefined' || !racine) return
    obs = new IntersectionObserver(
      (es) => {
        visible = !!es[es.length - 1]?.isIntersecting
        if (visible) demarrer()
        else arreter()
      },
      { rootMargin: '80px' }
    )
    obs.observe(racine)
  })
  surDemontage(() => {
    arreter()
    obs?.disconnect()
    document.removeEventListener('visibilitychange', surVisibilite)
  })

  // la scene est remplie a la main (deux images le temps d'une transition) : le dessin ne la touche pas
  return () =>
    h(
      'div',
      { ref: (el: Element | null) => (racine = el as HTMLElement | null), class: 'acc-defile' },
      h('div', { ref: (el: Element | null) => (scene = el as HTMLElement | null), class: 'acc-defile-scene' })
    )
}
