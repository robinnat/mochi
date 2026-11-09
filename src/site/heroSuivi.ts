import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Le grand Mochi suit le pointeur (souris seulement) : les yeux regardent, le corps se tourne un peu (`yaw`).
 * Meme comportement que le hero actuel, partage par les directions a l'essai.
 */
export function useSuiviPointeur(
  scene: Ref<HTMLElement | null>,
  regarder: (c: { nx: number; ny: number } | null) => void,
  reduit: Ref<boolean>
) {
  const yaw = ref(0)
  function onMove(e: PointerEvent) {
    if (e.pointerType === 'touch' || !scene.value) return
    const r = scene.value.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) return
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.32)))
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.4)))
    regarder({ nx, ny })
    const v = Math.round(nx * 0.38 * 200) / 200
    if (v !== yaw.value) yaw.value = v
  }
  const onLeave = () => regarder(null)
  onMounted(() => {
    if (reduit.value) return
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
  })
  return { yaw }
}
