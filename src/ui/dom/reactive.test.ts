import { describe, expect, it } from 'vitest'
import { Scope, computed, within, link, nextTick, ref, shallowRef, triggerRef, watch, watchEffect } from './reactive'

describe('reactivite maison', () => {
  it('computed follows its sources and only recomputes when they change', () => {
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

  it('watch runs queued, once per task, with the previous value', async () => {
    const a = ref(1)
    const seen: [number, number | undefined][] = []
    watch(a, (v, before) => seen.push([v, before]))
    a.value = 2
    a.value = 3
    expect(seen).toEqual([])
    await nextTick()
    expect(seen).toEqual([[3, 1]])
  })

  it('watch of a list of sources, immediate', async () => {
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

  it('shallowRef + triggerRef reruns a watch even if the object is the same', async () => {
    const o = shallowRef({ n: 0 })
    let n = 0
    watch(o, () => n++)
    o.value.n++
    triggerRef(o)
    await nextTick()
    expect(n).toBe(1)
  })

  it('flush post watchers run after the others', async () => {
    const a = ref(0)
    const order: string[] = []
    watch(a, () => order.push('post'), { flush: 'post' })
    watch(a, () => order.push('pre'))
    a.value = 1
    await nextTick()
    expect(order).toEqual(['pre', 'post'])
  })

  it('a stopped scope cuts its watchers', async () => {
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

  it('writable computed and link', () => {
    const a = ref(1)
    const c = computed({ get: () => a.value, set: (v: number) => (a.value = v * 10) })
    c.value = 2
    expect(a.value).toBe(20)
    const l = link(() => a.value, (v) => (a.value = v + 1))
    l.value = 5
    expect(a.value).toBe(6)
  })
})
