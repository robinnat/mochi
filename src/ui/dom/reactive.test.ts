import { describe, expect, it } from 'vitest'
import { Scope, computed, within, link, nextTick, ref, shallowRef, triggerRef, watch, watchEffect } from './reactive'

describe('reactivite maison', () => {
  it('computed suit ses sources et ne recalcule que si elles changent', () => {
    const a = ref(1)
    let n = 0
    const double = computed(() => (n++, a.value * 2))
    expect(double.value).toBe(2)
    expect(double.value).toBe(2)
    expect(n).toBe(1)
    a.value = 3
    expect(double.value).toBe(6)
    expect(n).toBe(2)
  })

  it('watch joue en file, une fois par tache, avec la valeur d avant', async () => {
    const a = ref(1)
    const seen: [number, number | undefined][] = []
    watch(a, (v, before) => seen.push([v, before]))
    a.value = 2
    a.value = 3
    expect(seen).toEqual([])
    await nextTick()
    expect(seen).toEqual([[3, 1]])
  })

  it('watch d une liste de sources, immediate', async () => {
    const a = ref(1)
    const b = ref('x')
    const seen: unknown[] = []
    watch([a, () => b.value], (v) => seen.push(v), { immediate: true })
    expect(seen).toEqual([[1, 'x']])
    b.value = 'y'
    await nextTick()
    expect(seen).toEqual([
      [1, 'x'],
      [1, 'y']
    ])
  })

  it('shallowRef + triggerRef relance un watch meme si l objet est le meme', async () => {
    const o = shallowRef({ n: 0 })
    let n = 0
    watch(o, () => n++)
    o.value.n++
    triggerRef(o)
    await nextTick()
    expect(n).toBe(1)
  })

  it('les observateurs flush post passent apres les autres', async () => {
    const a = ref(0)
    const order: string[] = []
    watch(a, () => order.push('post'), { flush: 'post' })
    watch(a, () => order.push('pre'))
    a.value = 1
    await nextTick()
    expect(order).toEqual(['pre', 'post'])
  })

  it('une portee arretee coupe ses observateurs', async () => {
    const p = new Scope()
    const a = ref(0)
    let n = 0
    within(p, () => watchEffect(() => (a.value, n++)))
    expect(n).toBe(1)
    p.stop()
    a.value = 1
    await nextTick()
    expect(n).toBe(1)
  })

  it('computed ecrivable et lien', () => {
    const a = ref(1)
    const c = computed({ get: () => a.value, set: (v: number) => (a.value = v * 10) })
    c.value = 2
    expect(a.value).toBe(20)
    const l = link(() => a.value, (v) => (a.value = v + 1))
    l.value = 5
    expect(a.value).toBe(6)
  })
})
