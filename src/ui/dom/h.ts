/**
 * Rendu de l'interface, sans dependance : une description de l'arbre (`h(...)`) et une mise a jour
 * qui ne touche que ce qui a change dans le DOM.
 *
 * - `h('div', { class, style, onClick, ref }, children)` decrit un element ; `h(Component, props)`
 *   un composant. Un composant est une fonction de mise en place qui recoit ses props (lues en
 *   direct : elles suivent le parent) et rend une fonction de dessin. Sa fonction de dessin est un
 *   effet : elle se relance seule quand ce qu'elle lit change.
 * - Les enfants d'une liste se retrouvent par leur `key` (sinon par leur rang) : un element garde
 *   son noeud DOM, donc son focus, sa selection, son canvas.
 * - `ref` (fonction) recoit l'element une fois en place dans la page, puis `null` a son retrait.
 *   Les crochets `onMount` d'un composant partent au meme moment.
 *
 * Utilise par le site, l'application, le labo et le dessin SVG de `<mochi-bot>`.
 */

import { Effect, Scope, within, scheduleRender, setWithoutSignal, ref, untracked, onCleanup, type Ref } from './reactive'

export type Props = Record<string, unknown>
export type Child = VNode | string | number | boolean | null | undefined | Child[]

/** Un composant : met en place son etat a partir de ses props, puis rend une fonction de dessin. */
export type Component<P = Props> = (props: P) => () => Child

const TEXT = Symbol('text')
const EMPTY = Symbol('empty')

export interface VNode {
  type: string | Component<never> | typeof TEXT | typeof EMPTY
  props: Props
  children: VNode[]
  key: unknown
  el: Node | null
  inst: Instance | null
  text?: string
}

interface Instance {
  id: number
  props: Props
  refs: Map<string, Ref<unknown>>
  tree: VNode | null
  effect: Effect
  scope: Scope
  sale: boolean
  unmounted: boolean
  job: () => void
}

let numero = 0

/* ------------------------------------------------------------------ h */

export function h(type: string | Component<never>, props?: Props | null, ...children: Child[]): VNode {
  const p = props ?? {}
  return { type, props: p, children: normalize(children), key: p.key, el: null, inst: null }
}

/** `h` d'un composant type : les props sont verifiees a la compilation. */
export function c<P>(comp: Component<P>, props: P & { key?: unknown }): VNode {
  return h(comp as Component<never>, props as unknown as Props)
}

function normalize(children: Child[], out: VNode[] = []): VNode[] {
  for (const e of children) {
    if (e === null || e === undefined || e === false || e === true) continue
    if (Array.isArray(e)) normalize(e, out)
    else if (typeof e === 'object') out.push(e)
    else out.push({ type: TEXT, props: {}, children: [], key: undefined, el: null, inst: null, text: String(e) })
  }
  return out
}

/* --------------------------------------------------- crochets de composant */

let toCall: (() => void)[] = []

/** Appelee une fois le composant en place dans la page. */
export function onMount(fn: () => void) {
  toCall.push(fn)
}
/** Appelee juste avant le retrait du composant. */
export const onUnmount = onCleanup

function clearCalls() {
  while (toCall.length) {
    const l = toCall
    toCall = []
    for (const f of l) f()
  }
}

/* ------------------------------------------------------------------ montage */

const SVG = 'http://www.w3.org/2000/svg'

function bow(v: VNode): Node {
  if (v.inst) return bow(v.inst.tree!)
  return v.el!
}

function mount(v: VNode, parent: Node, anchor: Node | null, svg: boolean) {
  if (v.type === TEXT) {
    v.el = document.createTextNode(v.text!)
    parent.insertBefore(v.el, anchor)
    return
  }
  if (v.type === EMPTY) {
    v.el = document.createComment('')
    parent.insertBefore(v.el, anchor)
    return
  }
  if (typeof v.type === 'function') return mountComponent(v, parent, anchor, svg)
  const tag = v.type as string
  const asSvg = svg || tag === 'svg'
  const el = asSvg ? document.createElementNS(SVG, tag) : document.createElement(tag)
  v.el = el
  // un element personnalise doit etre defini pour recevoir ses proprietes
  applyProps(el as HTMLElement, {}, v.props, asSvg)
  const svgChildren = asSvg && tag !== 'foreignObject'
  if (!('innerHTML' in v.props)) for (const e of v.children) mount(e, el, null, svgChildren)
  parent.insertBefore(el, anchor)
  const r = v.props.ref as ((e: Element | null) => void) | undefined
  if (r) toCall.push(() => r(el))
}

function mountComponent(v: VNode, parent: Node, anchor: Node | null, svg: boolean) {
  const refs = new Map<string, Ref<unknown>>()
  const raw = { ...v.props }
  const props = new Proxy(raw, {
    get(target, key: string) {
      let r = refs.get(key)
      if (!r) {
        r = ref(target[key])
        refs.set(key, r)
      }
      return r.value
    },
    set() {
      return false
    }
  })
  const scope = new Scope()
  const inst: Instance = {
    id: ++numero,
    props: raw,
    refs,
    tree: null,
    scope,
    sale: false,
    unmounted: false,
    effect: null as unknown as Effect,
    job: () => {}
  }
  v.inst = inst
  // les crochets `onMount` de la mise en place partent APRES les `ref` du dessin (les elements sont alors connus)
  const before = toCall.length
  const drawing = within(scope, () => untracked(() => (v.type as Component<Props>)(props)))
  const crochets = toCall.splice(before)
  const render = () => {
    const r = normalize([drawing()])
    return r[0] ?? { type: EMPTY, props: {}, children: [], key: undefined, el: null, inst: null }
  }
  inst.effect = new Effect(
    () => {
      const fresh = within(scope, render)
      if (!inst.tree) {
        inst.tree = fresh
        mount(fresh, parent, anchor, svg)
      } else {
        const old = inst.tree
        const p = bow(old).parentNode!
        inst.tree = fresh
        patch(old, fresh, p, svg)
      }
    },
    () => {
      if (inst.unmounted) return
      inst.sale = true
      scheduleRender(inst.id, inst.job)
    }
  )
  inst.job = () => {
    if (!inst.sale || inst.unmounted) return
    inst.sale = false
    inst.effect.run()
    clearCalls()
  }
  inst.effect.run()
  toCall.push(...crochets)
}

function updateProps(inst: Instance, next: Props): boolean {
  let change = false
  for (const k of new Set([...Object.keys(inst.props), ...Object.keys(next)])) {
    const v = next[k]
    if (Object.is(inst.props[k], v)) continue
    const before = inst.props[k]
    inst.props[k] = v
    const r = inst.refs.get(k)
    // un gestionnaire recree a chaque dessin du parent ne redessine pas l'enfant : il est seulement remplace
    if (typeof v === 'function' && typeof before === 'function') {
      if (r) setWithoutSignal(r, v)
      continue
    }
    if (r) r.value = v
    change = true
  }
  return change
}

function unmount(v: VNode, remove = true) {
  if (v.inst) {
    const i = v.inst
    i.unmounted = true
    i.scope.stop()
    i.effect.stop()
    if (i.tree) unmount(i.tree, remove)
    return
  }
  const r = v.props.ref as ((e: Element | null) => void) | undefined
  if (r) r(null)
  for (const e of v.children) unmount(e, false)
  if (remove && v.el?.parentNode) v.el.parentNode.removeChild(v.el)
}

/* --------------------------------------------------------------------- patch */

const same = (a: VNode, b: VNode) => a.type === b.type && a.key === b.key

function patch(a: VNode, b: VNode, parent: Node, svg: boolean) {
  if (!same(a, b)) {
    const anchor = bow(a)
    mount(b, parent, anchor, svg)
    unmount(a)
    return
  }
  if (a.type === TEXT) {
    b.el = a.el
    if (a.text !== b.text) (b.el as Text).data = b.text!
    return
  }
  if (a.type === EMPTY) {
    b.el = a.el
    return
  }
  if (typeof a.type === 'function') {
    const inst = a.inst!
    b.inst = inst
    if (updateProps(inst, b.props) && inst.sale) inst.job()
    return
  }
  const el = (b.el = a.el) as HTMLElement
  const tag = b.type as string
  const asSvg = svg || tag === 'svg'
  applyProps(el, a.props, b.props, asSvg)
  if ('innerHTML' in b.props) return
  if ('innerHTML' in a.props) {
    el.textContent = ''
    for (const e of b.children) mount(e, el, null, asSvg && tag !== 'foreignObject')
    return
  }
  patchChildren(el, a.children, b.children, asSvg && tag !== 'foreignObject')
  const ra = a.props.ref
  const rb = b.props.ref as ((e: Element | null) => void) | undefined
  if (ra !== rb) {
    ;(ra as ((e: Element | null) => void) | undefined)?.(null)
    if (rb) toCall.push(() => rb(el))
  }
}

function patchChildren(el: Node, old: VNode[], freshOnes: VNode[], svg: boolean) {
  const byKey = new Map<unknown, VNode>()
  for (const a of old) if (a.key !== undefined) byKey.set(a.key, a)
  const taken = new Set<VNode>()
  const pairs: (VNode | null)[] = freshOnes.map((n, i) => {
    let a: VNode | undefined
    if (n.key !== undefined) a = byKey.get(n.key)
    else {
      const x = old[i]
      if (x && x.key === undefined && x.type === n.type) a = x
    }
    if (a && !taken.has(a) && same(a, n)) {
      taken.add(a)
      return a
    }
    return null
  })
  for (const a of old) if (!taken.has(a)) unmount(a)
  // de la fin vers le debut : chaque noeud se place juste avant le suivant
  let next: Node | null = null
  for (let i = freshOnes.length - 1; i >= 0; i--) {
    const n = freshOnes[i]!
    const a = pairs[i]
    if (a) {
      patch(a, n, el, svg)
      const x = bow(n)
      if (x.nextSibling !== next || x.parentNode !== el) el.insertBefore(x, next)
    } else mount(n, el, next, svg)
    next = bow(n)
  }
}

/* --------------------------------------------------------------- proprietes */

/** Proprietes posees comme proprietes DOM (et non comme attributs). */
const PROP_DOM = new Set(['value', 'checked', 'selected', 'indeterminate', 'muted', 'innerHTML', 'textContent', 'scrollLeft'])
/** Attributs booleens : presents ou absents. */
const BOOLEANS = new Set([
  'disabled',
  'hidden',
  'inert',
  'readonly',
  'required',
  'multiple',
  'autofocus',
  'novalidate',
  'formnovalidate',
  'open',
  'popover',
  'allowfullscreen',
  'itemscope',
  'ismap',
  'nomodule'
])

export function classOf(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(classOf).filter(Boolean).join(' ')
  if (typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(' ')
  return ''
}

function styleObject(v: unknown): Record<string, string> {
  if (!v) return {}
  if (typeof v === 'string') {
    const o: Record<string, string> = {}
    for (const d of v.split(';')) {
      const i = d.indexOf(':')
      if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
    return o
  }
  if (Array.isArray(v)) return Object.assign({}, ...v.map(styleObject))
  const o: Record<string, string> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (x === undefined || x === null || x === false) continue
    o[k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())] = String(x)
  }
  return o
}

type Invoker = ((e: Event) => void) & { fn?: (e: Event) => void }

function applyProps(el: HTMLElement, a: Props, b: Props, svg: boolean) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'key' || k === 'ref') continue
    const va = a[k]
    const vb = b[k]
    if (k === 'class') {
      const ca = classOf(va)
      let cb = classOf(vb)
      if (ca === cb) continue
      // classes posees a la main sur l'element (apparition au defilement) : gardees
      const keep = (el as unknown as { __keep?: string[] }).__keep
      if (keep) cb = [cb, ...keep.filter((x) => el.classList.contains(x))].filter(Boolean).join(' ')
      if (cb) el.setAttribute('class', cb)
      else el.removeAttribute('class')
      continue
    }
    if (k === 'style') {
      const its = styleObject(va)
      const sb = styleObject(vb)
      for (const p of Object.keys(its)) if (!(p in sb)) el.style.removeProperty(p)
      for (const [p, x] of Object.entries(sb)) if (its[p] !== x || el.style.getPropertyValue(p) !== x) el.style.setProperty(p, x)
      continue
    }
    if (Object.is(va, vb) && va !== undefined && !(k in PROP_DOM_CHECK)) continue
    if (k.startsWith('on') && k.length > 2 && (typeof vb === 'function' || typeof va === 'function')) {
      const name = k.slice(2).toLowerCase()
      const store = ((el as unknown as { _ev?: Record<string, Invoker> })._ev ??= {})
      let inv = store[name]
      if (typeof vb === 'function') {
        if (!inv) {
          inv = ((e: Event) => inv!.fn?.(e)) as Invoker
          store[name] = inv
          el.addEventListener(name, inv)
        }
        inv.fn = vb as (e: Event) => void
      } else if (inv) {
        el.removeEventListener(name, inv)
        delete store[name]
      }
      continue
    }
    if (PROP_DOM.has(k)) {
      const x = vb ?? (k === 'value' || k === 'innerHTML' || k === 'textContent' ? '' : false)
      if ((el as unknown as Props)[k] !== x) (el as unknown as Props)[k] = x
      continue
    }
    // element personnalise : une propriete qu'il declare se passe telle quelle (objet, fonction...)
    if (!svg && el.localName.includes('-') && k in el) {
      ;(el as unknown as Props)[k] = vb
      continue
    }
    if (vb === null || vb === undefined || (BOOLEANS.has(k) && vb === false)) {
      el.removeAttribute(k)
      if (k === 'inert' && 'inert' in el) el.inert = false
      continue
    }
    if (k === 'inert' && 'inert' in el) el.inert = true
    el.setAttribute(k, BOOLEANS.has(k) && vb === true ? '' : String(vb))
  }
}

/** Proprietes relues sur l'element a chaque passage : l'utilisateur peut les avoir changees (champ saisi). */
const PROP_DOM_CHECK: Record<string, true> = { value: true, checked: true }

/* ------------------------------------------------------------------- racine */

const ROOTS = new WeakMap<Node, VNode>()

/** Dessine `v` dans `container` (son unique enfant gere), en reprenant le dessin precedent s'il y en a un. */
export function render(v: VNode | null, container: Node, svg = false) {
  const old = ROOTS.get(container)
  if (!v) {
    if (old) unmount(old)
    ROOTS.delete(container)
    clearCalls()
    return
  }
  if (old) patch(old, v, container, svg)
  else mount(v, container, null, svg)
  ROOTS.set(container, v)
  clearCalls()
}

/** Monte un composant dans un element de la page ; renvoie de quoi le retirer. */
export function mountApp<P extends Props>(comp: Component<P>, target: Element | string, props?: P): () => void {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) throw new Error(`mochi: target introuvable ${String(target)}`)
  render(h(comp as unknown as Component<never>, props ?? {}), el)
  return () => render(null, el)
}
