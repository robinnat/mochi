import { ref, watch } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import type { MochiBotElement, MochiBotProps } from 'mochi-world'
import { urlAffiche } from './affiches'
import { themeEffectif } from './theme'
import { pagePrete, prechaufferStyles, RATIO_MAX, FPS_VIVANT } from './pret'

/**
 * Un Mochi vivant, sans jamais de 2D a l'ecran :
 * 1. l'affiche (image pre-rendue de la vraie 3D, meme cadrage, meme pose) s'affiche tout de suite ;
 * 2. quand l'element est a l'ecran ET que la page est prete, le composant (et Three.js) se charge, invisible ;
 * 3. a sa premiere image 3D (`pret`), il apparait en fondu par-dessus l'affiche.
 * Hors de l'ecran, il est retire (aucune boucle ne tourne) et l'affiche reprend sa place.
 * Sans affiche (`affiche` nul), la place reste vide jusqu'au fondu.
 */
export interface VivantProps {
  taille: number
  affiche?: string | null
  alt?: string
  marge?: string
  eager?: boolean
  yaw?: number
  tourner?: boolean
  /** les options du `<mochi-bot>` (forme, couleur, humeur...) */
  bot?: Partial<MochiBotProps>
}

/** Le composant `<mochi-bot>` n'est charge qu'au premier Mochi vivant a monter (import dynamique, partage). */
let chargement: Promise<unknown> | null = null
const composantCharge = ref(typeof customElements !== 'undefined' && !!customElements.get('mochi-bot'))
function chargerComposant() {
  chargement ??= import('mochi-world').then(() => (composantCharge.value = true))
}

export const Vivant: Composant<VivantProps> = (props) => {
  let racine: HTMLElement | null = null
  const visible = ref(false)
  const monte = ref(false)
  const montre = ref(false)

  let obs: IntersectionObserver | null = null
  surMontage(() => {
    if (typeof IntersectionObserver === 'undefined' || !racine) {
      visible.value = true
      return
    }
    obs = new IntersectionObserver((es) => (visible.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: props.marge ?? '200px' })
    obs.observe(racine)
  })
  surDemontage(() => obs?.disconnect())

  /* ------------------------------------------------------------------ tourner au doigt (ou a la souris), avec inertie */
  /**
   * Un glisse plutot horizontal sur le Mochi le fait tourner (`yaw`) ; un glisse plutot vertical laisse la page
   * defiler (`touch-action: pan-y`). Au lacher, il continue sur sa lancee et ralentit. Le tap, le double tap et
   * l'appui long restent ceux du composant.
   */
  const spin = ref(0)
  /** radians par pixel glisse : un glisse de la largeur du Mochi fait a peu pres un tour */
  const K = () => (2 * Math.PI) / Math.max(120, props.taille * 1.1)
  let glisse: { id: number; x0: number; y0: number; x: number; t: number; actif: boolean } | null = null
  let vitesse = 0
  let rafInertie = 0
  function arreterInertie() {
    cancelAnimationFrame(rafInertie)
    rafInertie = 0
  }
  const tourner = () => props.tourner ?? true
  function onDown(e: PointerEvent) {
    if (!tourner() || !monte.value || (e.button !== undefined && e.button > 0)) return
    arreterInertie()
    vitesse = 0
    glisse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, actif: false }
  }
  function onMove(e: PointerEvent) {
    const g = glisse
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0
    if (!g.actif) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.actif = true
        g.x = e.clientX
        try {
          racine?.setPointerCapture(e.pointerId)
        } catch {
          // pointeur deja relache
        }
      } else if (Math.abs(dy) > 10) {
        glisse = null
      }
      return
    }
    const d = (e.clientX - g.x) * K()
    const dt = Math.max(1, e.timeStamp - g.t)
    spin.value += d
    // vitesse lissee (radians par ms), pour une lancee reguliere
    vitesse = vitesse * 0.6 + (d / dt) * 0.4
    g.x = e.clientX
    g.t = e.timeStamp
  }
  function onUp(e: PointerEvent) {
    const g = glisse
    if (!g || e.pointerId !== g.id) return
    glisse = null
    if (!g.actif || e.timeStamp - g.t > 80) return
    let prec = 0
    const pas = (t: number) => {
      const dt = prec ? Math.min(48, t - prec) : 16
      prec = t
      spin.value += vitesse * dt
      vitesse *= Math.exp(-dt / 420)
      rafInertie = Math.abs(vitesse) > 0.00004 ? requestAnimationFrame(pas) : 0
    }
    rafInertie = requestAnimationFrame(pas)
  }
  surDemontage(arreterInertie)

  function surPret() {
    montre.value = true
    prechaufferStyles()
  }

  watch(
    [visible, pagePrete],
    ([v, p]) => {
      if (v && p) {
        monte.value = true
        chargerComposant()
      } else if (!v) {
        monte.value = false
        montre.value = false
      }
    },
    { immediate: true }
  )

  return () => {
    const t = props.taille
    const eager = props.eager ?? false
    return h(
      'div',
      {
        ref: (el: Element | null) => (racine = el as HTMLElement | null),
        class: ['vivant', { tournable: tourner() && monte.value }],
        style: { width: t + 'px', height: t + 'px' },
        onPointerdown: onDown,
        onPointermove: onMove,
        onPointerup: onUp,
        onPointercancel: onUp
      },
      props.affiche
        ? h('img', {
            key: 'affiche',
            class: ['vivant-affiche', { cache: montre.value }],
            src: urlAffiche(props.affiche, themeEffectif.value),
            width: t,
            height: t,
            alt: montre.value ? '' : (props.alt ?? ''),
            loading: eager ? 'eager' : 'lazy',
            fetchpriority: eager ? 'high' : undefined,
            decoding: 'async',
            draggable: 'false'
          })
        : null,
      monte.value && composantCharge.value
        ? h(
            'div',
            { key: 'bot', class: ['vivant-bot', { on: montre.value }] },
            h('mochi-bot', {
              ...props.bot,
              size: t,
              yaw: (props.yaw ?? 0) + spin.value,
              label: props.alt ?? '',
              maxPixelRatio: RATIO_MAX,
              fps: FPS_VIVANT,
              onPret: surPret
            })
          )
        : null
    )
  }
}

export type { MochiBotElement }
