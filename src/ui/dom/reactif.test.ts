import { describe, expect, it } from 'vitest'
import { Portee, computed, dans, lien, nextTick, ref, shallowRef, triggerRef, watch, watchEffect } from './reactif'

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
    const vu: [number, number | undefined][] = []
    watch(a, (v, avant) => vu.push([v, avant]))
    a.value = 2
    a.value = 3
    expect(vu).toEqual([])
    await nextTick()
    expect(vu).toEqual([[3, 1]])
  })

  it('watch d une liste de sources, immediate', async () => {
    const a = ref(1)
    const b = ref('x')
    const vu: unknown[] = []
    watch([a, () => b.value], (v) => vu.push(v), { immediate: true })
    expect(vu).toEqual([[1, 'x']])
    b.value = 'y'
    await nextTick()
    expect(vu).toEqual([
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
    const ordre: string[] = []
    watch(a, () => ordre.push('post'), { flush: 'post' })
    watch(a, () => ordre.push('pre'))
    a.value = 1
    await nextTick()
    expect(ordre).toEqual(['pre', 'post'])
  })

  it('une portee arretee coupe ses observateurs', async () => {
    const p = new Portee()
    const a = ref(0)
    let n = 0
    dans(p, () => watchEffect(() => (a.value, n++)))
    expect(n).toBe(1)
    p.arreter()
    a.value = 1
    await nextTick()
    expect(n).toBe(1)
  })

  it('computed ecrivable et lien', () => {
    const a = ref(1)
    const c = computed({ get: () => a.value, set: (v: number) => (a.value = v * 10) })
    c.value = 2
    expect(a.value).toBe(20)
    const l = lien(() => a.value, (v) => (a.value = v + 1))
    l.value = 5
    expect(a.value).toBe(6)
  })
})
