// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { nextTick, ref, watch } from './reactif'
import { c, h, monterApp, rendre, surDemontage, surMontage, type Composant } from './h'

describe('rendu de l interface', () => {
  it('cree et met a jour attributs, classes, styles et texte', () => {
    const el = document.createElement('div')
    rendre(h('p', { class: ['a', { b: true, c: false }], style: { color: 'red', '--x': '1' }, title: 't' }, 'bonjour'), el)
    const p = el.firstElementChild as HTMLElement
    expect(p.className).toBe('a b')
    expect(p.style.getPropertyValue('--x')).toBe('1')
    expect(p.textContent).toBe('bonjour')
    rendre(h('p', { class: 'a', title: null }, 'salut'), el)
    expect(el.firstElementChild).toBe(p)
    expect(p.className).toBe('a')
    expect(p.hasAttribute('title')).toBe(false)
    expect(p.style.getPropertyValue('color')).toBe('')
    expect(p.textContent).toBe('salut')
  })

  it('les enfants a cle gardent leur noeud quand l ordre change', () => {
    const el = document.createElement('ul')
    rendre(h('div', null, ['a', 'b', 'c'].map((k) => h('li', { key: k }, k))), el)
    const avant = [...el.querySelectorAll('li')]
    rendre(h('div', null, ['c', 'a', 'b'].map((k) => h('li', { key: k }, k))), el)
    const apres = [...el.querySelectorAll('li')]
    expect(apres.map((x) => x.textContent)).toEqual(['c', 'a', 'b'])
    expect(apres[0]).toBe(avant[2])
    expect(apres[1]).toBe(avant[0])
  })

  it('evenements, attributs aria booleens et SVG', () => {
    const el = document.createElement('div')
    let n = 0
    rendre(h('button', { 'aria-pressed': false, onClick: () => n++ }, h('svg', { viewBox: '0 0 1 1' }, h('path', { d: 'M0 0' }))), el)
    const b = el.querySelector('button')!
    expect(b.getAttribute('aria-pressed')).toBe('false')
    b.click()
    expect(n).toBe(1)
    expect(el.querySelector('path')!.namespaceURI).toBe('http://www.w3.org/2000/svg')
  })

  it('un composant se redessine seul quand son etat change, et se nettoie au retrait', async () => {
    const journal: string[] = []
    const Compteur: Composant<{ pas: number }> = (props) => {
      const n = ref(0)
      surMontage(() => journal.push('monte'))
      surDemontage(() => journal.push('retire'))
      return () => h('button', { onClick: () => (n.value += props.pas) }, String(n.value))
    }
    const el = document.createElement('div')
    document.body.appendChild(el)
    const retirer = monterApp(Compteur, el, { pas: 2 })
    expect(journal).toEqual(['monte'])
    el.querySelector('button')!.click()
    await nextTick()
    expect(el.textContent).toBe('2')
    retirer()
    expect(journal).toEqual(['monte', 'retire'])
    expect(el.innerHTML).toBe('')
  })

  it('les props d un enfant suivent le parent', async () => {
    const Enfant: Composant<{ texte: string }> = (props) => () => h('span', null, props.texte)
    const texte = ref('a')
    const Parent: Composant<Record<string, never>> = () => () => h('div', null, c(Enfant, { texte: texte.value }))
    const el = document.createElement('div')
    monterApp(Parent, el)
    expect(el.textContent).toBe('a')
    texte.value = 'b'
    await nextTick()
    expect(el.textContent).toBe('b')
  })
})

describe('ordre du montage', () => {
  it('surMontage voit deja les elements poses par ref', () => {
    let vu: Element | null = null
    let auMontage: Element | null | undefined
    const C: Composant<Record<string, never>> = () => {
      surMontage(() => (auMontage = vu))
      return () => h('div', null, h('span', { ref: (e: Element | null) => (vu = e) }))
    }
    monterApp(C, document.createElement('div'))
    expect(auMontage).not.toBeNull()
    expect(auMontage?.tagName).toBe('SPAN')
  })
})

describe('observateurs crees pendant la mise en place', () => {
  it('un watch d un composant suit ses sources', async () => {
    const vu: number[] = []
    const n = ref(0)
    const C: Composant<Record<string, never>> = () => {
      watch(n, (v) => vu.push(v))
      return () => h('p', null, 'x')
    }
    monterApp(C, document.createElement('div'))
    n.value = 1
    await nextTick()
    expect(vu).toEqual([1])
  })
})
