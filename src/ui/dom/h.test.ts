// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { nextTick, ref, watch } from './reactive'
import { c, h, mountApp, render, onUnmount, onMount, type Component } from './h'

describe('interface rendering', () => {
  it('creates and updates attributes, classes, styles and text', () => {
    const el = document.createElement('div')
    render(h('p', { class: ['a', { b: true, c: false }], style: { color: 'red', '--x': '1' }, title: 't' }, 'bonjour'), el)
    const p = el.firstElementChild as HTMLElement
    expect(p.className).toBe('a b')
    expect(p.style.getPropertyValue('--x')).toBe('1')
    expect(p.textContent).toBe('bonjour')
    render(h('p', { class: 'a', title: null }, 'hello'), el)
    expect(el.firstElementChild).toBe(p)
    expect(p.className).toBe('a')
    expect(p.hasAttribute('title')).toBe(false)
    expect(p.style.getPropertyValue('color')).toBe('')
    expect(p.textContent).toBe('hello')
  })

  it('keyed children keep their node when the order changes', () => {
    const el = document.createElement('ul')
    render(h('div', null, ['a', 'b', 'c'].map((k) => h('li', { key: k }, k))), el)
    const before = [...el.querySelectorAll('li')]
    render(h('div', null, ['c', 'a', 'b'].map((k) => h('li', { key: k }, k))), el)
    const after = [...el.querySelectorAll('li')]
    expect(after.map((x) => x.textContent)).toEqual(['c', 'a', 'b'])
    expect(after[0]).toBe(before[2])
    expect(after[1]).toBe(before[0])
  })

  it('events, boolean aria attributes and SVG', () => {
    const el = document.createElement('div')
    let n = 0
    render(h('button', { 'aria-pressed': false, onClick: () => n++ }, h('svg', { viewBox: '0 0 1 1' }, h('path', { d: 'M0 0' }))), el)
    const b = el.querySelector('button')!
    expect(b.getAttribute('aria-pressed')).toBe('false')
    b.click()
    expect(n).toBe(1)
    expect(el.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg')
  })

  it('a component redraws by itself when its state changes, and cleans up on removal', async () => {
    const journal: string[] = []
    const Counter: Component<{ step: number }> = (props) => {
      const n = ref(0)
      onMount(() => journal.push('monte'))
      onUnmount(() => journal.push('removed'))
      return () => h('button', { onClick: () => (n.value += props.step) }, String(n.value))
    }
    const el = document.createElement('div')
    document.body.appendChild(el)
    const remove = mountApp(Counter, el, { step: 2 })
    expect(journal).toEqual(['monte'])
    el.querySelector('button')!.click()
    await nextTick()
    expect(el.textContent).toBe('2')
    remove()
    expect(journal).toEqual(['monte', 'removed'])
    expect(el.innerHTML).toBe('')
  })

  it('a child\'s props follow the parent', async () => {
    const Child: Component<{ text: string }> = (props) => () => h('span', null, props.text)
    const text = ref('a')
    const Parent: Component<Record<string, never>> = () => () => h('div', null, c(Child, { text: text.value }))
    const el = document.createElement('div')
    mountApp(Parent, el)
    expect(el.textContent).toBe('a')
    text.value = 'b'
    await nextTick()
    expect(el.textContent).toBe('b')
  })
})

describe('mount order', () => {
  it('onMount already sees the elements set by ref', () => {
    let seen: Element | null = null
    let atMount: Element | null | undefined
    const C: Component<Record<string, never>> = () => {
      onMount(() => (atMount = seen))
      return () => h('div', null, h('span', { ref: (e: Element | null) => (seen = e) }))
    }
    mountApp(C, document.createElement('div'))
    expect(atMount).not.toBeNull()
    expect(atMount?.tagName).toBe('SPAN')
  })
})

describe('watchers created during setup', () => {
  it('a component\'s watch follows its sources', async () => {
    const seen: number[] = []
    const n = ref(0)
    const C: Component<Record<string, never>> = () => {
      watch(n, (v) => seen.push(v))
      return () => h('p', null, 'x')
    }
    mountApp(C, document.createElement('div'))
    n.value = 1
    await nextTick()
    expect(seen).toEqual([1])
  })
})
