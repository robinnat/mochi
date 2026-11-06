import { onBeforeUnmount, onMounted, ref, type Directive, type Ref } from 'vue'

/**
 * Mouvements du site, sans bibliotheque : tout passe par `transform` et `opacity` (composites, 60 i/s),
 * un seul IntersectionObserver partage pour les apparitions, et une seule boucle `requestAnimationFrame`
 * par effet, qui ne tourne que pendant un defilement ou un mouvement du pointeur.
 * Avec `prefers-reduced-motion`, rien ne bouge : les elements sont visibles d'emblee.
 */

export const mouvementReduit = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let obs: IntersectionObserver | null = null
function observateur(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  obs ??= new IntersectionObserver(
    (entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue
        e.target.classList.add('in')
        obs?.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )
  return obs
}

/**
 * `v-reveal` : l'element apparait en glissant vers le haut quand il entre a l'ecran, une seule fois.
 * La valeur (facultative) est son rang dans un groupe : le decalage en cascade se lit dans `--i`.
 */
export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, b) {
    el.classList.add('rv')
    if (b.value !== undefined) el.style.setProperty('--i', String(b.value))
    const o = observateur()
    if (!o || mouvementReduit()) {
      el.classList.add('in')
      return
    }
    o.observe(el)
  },
  beforeUnmount(el) {
    obs?.unobserve(el)
  }
}

/**
 * Progression du defilement d'un element : 0 quand son haut touche le haut de la fenetre, 1 quand il en
 * est sorti de toute sa hauteur. Ecrite dans la variable CSS `--s` de l'element (et rendue), mise a jour
 * dans une image d'animation seulement quand la page defile. Rien sous `prefers-reduced-motion`.
 */
export function useDefilement(el: Ref<HTMLElement | null>, surChange?: (s: number) => void) {
  const s = ref(0)
  let raf = 0
  const maj = () => {
    raf = 0
    const e = el.value
    if (!e) return
    const r = e.getBoundingClientRect()
    const v = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))
    if (Math.abs(v - s.value) < 0.001) return
    s.value = v
    e.style.setProperty('--s', v.toFixed(4))
    surChange?.(v)
  }
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(maj)
  }
  onMounted(() => {
    if (mouvementReduit()) return
    window.addEventListener('scroll', onScroll, { passive: true })
    maj()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(raf)
  })
  return s
}

/**
 * Position du pointeur dans la fenetre, de -1 a 1 sur chaque axe, lissee (ressort critique simple) :
 * ecrite dans `--mx` et `--my` de l'element. La boucle s'arrete quand la valeur est atteinte.
 * Sur un ecran tactile sans survol, elle reste a 0.
 */
export function usePointeur(el: Ref<HTMLElement | null>, surChange?: (x: number, y: number) => void) {
  let cx = 0
  let cy = 0
  let x = 0
  let y = 0
  let raf = 0
  const pas = () => {
    raf = 0
    x += (cx - x) * 0.12
    y += (cy - y) * 0.12
    el.value?.style.setProperty('--mx', x.toFixed(4))
    el.value?.style.setProperty('--my', y.toFixed(4))
    surChange?.(x, y)
    if (Math.abs(cx - x) > 0.001 || Math.abs(cy - y) > 0.001) raf = requestAnimationFrame(pas)
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    cx = (e.clientX / window.innerWidth) * 2 - 1
    cy = (e.clientY / window.innerHeight) * 2 - 1
    if (!raf) raf = requestAnimationFrame(pas)
  }
  const onLeave = () => {
    cx = 0
    cy = 0
    if (!raf) raf = requestAnimationFrame(pas)
  }
  onMounted(() => {
    if (mouvementReduit()) return
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    cancelAnimationFrame(raf)
  })
}

/** Largeur de la fenetre, suivie (pour la taille des Mochi, qui est en pixels). */
export function useLargeur() {
  const w = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
  const maj = () => (w.value = window.innerWidth)
  onMounted(() => window.addEventListener('resize', maj, { passive: true }))
  onBeforeUnmount(() => window.removeEventListener('resize', maj))
  return w
}

/** Element visible a l'ecran (pour mettre en pause une boucle hors champ). */
export function useVisible(el: Ref<HTMLElement | null>, marge = '0px') {
  const v = ref(typeof IntersectionObserver === 'undefined')
  let o: IntersectionObserver | null = null
  onMounted(() => {
    if (typeof IntersectionObserver === 'undefined' || !el.value) return
    o = new IntersectionObserver((es) => (v.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: marge })
    o.observe(el.value)
  })
  onBeforeUnmount(() => o?.disconnect())
  return v
}
