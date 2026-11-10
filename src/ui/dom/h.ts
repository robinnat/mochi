/**
 * Rendu de l'interface, sans dependance : une description de l'arbre (`h(...)`) et une mise a jour
 * qui ne touche que ce qui a change dans le DOM.
 *
 * - `h('div', { class, style, onClick, ref }, enfants)` decrit un element ; `h(Composant, props)`
 *   un composant. Un composant est une fonction de mise en place qui recoit ses props (lues en
 *   direct : elles suivent le parent) et rend une fonction de dessin. Sa fonction de dessin est un
 *   effet : elle se relance seule quand ce qu'elle lit change.
 * - Les enfants d'une liste se retrouvent par leur `key` (sinon par leur rang) : un element garde
 *   son noeud DOM, donc son focus, sa selection, son canvas.
 * - `ref` (fonction) recoit l'element une fois en place dans la page, puis `null` a son retrait.
 *   Les crochets `surMontage` d'un composant partent au meme moment.
 *
 * Utilise par le site, l'application, le labo et le dessin SVG de `<mochi-bot>`.
 */

import { Effet, Portee, dans, planifierRendu, poserSansSignal, ref, sansSuivi, surNettoyage, type Ref } from './reactif'

export type Props = Record<string, unknown>
export type Enfant = VNode | string | number | boolean | null | undefined | Enfant[]

/** Un composant : met en place son etat a partir de ses props, puis rend une fonction de dessin. */
export type Composant<P = Props> = (props: P) => () => Enfant

const TEXTE = Symbol('texte')
const VIDE = Symbol('vide')

export interface VNode {
  type: string | Composant<never> | typeof TEXTE | typeof VIDE
  props: Props
  enfants: VNode[]
  key: unknown
  el: Node | null
  inst: Instance | null
  texte?: string
}

interface Instance {
  id: number
  props: Props
  refs: Map<string, Ref<unknown>>
  arbre: VNode | null
  effet: Effet
  portee: Portee
  sale: boolean
  demonte: boolean
  job: () => void
}

let numero = 0

/* ------------------------------------------------------------------ h */

export function h(type: string | Composant<never>, props?: Props | null, ...enfants: Enfant[]): VNode {
  const p = props ?? {}
  return { type, props: p, enfants: normaliser(enfants), key: p.key, el: null, inst: null }
}

/** `h` d'un composant type : les props sont verifiees a la compilation. */
export function c<P>(comp: Composant<P>, props: P & { key?: unknown }): VNode {
  return h(comp as Composant<never>, props as unknown as Props)
}

function normaliser(enfants: Enfant[], out: VNode[] = []): VNode[] {
  for (const e of enfants) {
    if (e === null || e === undefined || e === false || e === true) continue
    if (Array.isArray(e)) normaliser(e, out)
    else if (typeof e === 'object') out.push(e)
    else out.push({ type: TEXTE, props: {}, enfants: [], key: undefined, el: null, inst: null, texte: String(e) })
  }
  return out
}

/* --------------------------------------------------- crochets de composant */

let aAppeler: (() => void)[] = []

/** Appelee une fois le composant en place dans la page. */
export function surMontage(fn: () => void) {
  aAppeler.push(fn)
}
/** Appelee juste avant le retrait du composant. */
export const surDemontage = surNettoyage

function viderAppels() {
  while (aAppeler.length) {
    const l = aAppeler
    aAppeler = []
    for (const f of l) f()
  }
}

/* ------------------------------------------------------------------ montage */

const SVG = 'http://www.w3.org/2000/svg'

function noeud(v: VNode): Node {
  if (v.inst) return noeud(v.inst.arbre!)
  return v.el!
}

function monter(v: VNode, parent: Node, ancre: Node | null, svg: boolean) {
  if (v.type === TEXTE) {
    v.el = document.createTextNode(v.texte!)
    parent.insertBefore(v.el, ancre)
    return
  }
  if (v.type === VIDE) {
    v.el = document.createComment('')
    parent.insertBefore(v.el, ancre)
    return
  }
  if (typeof v.type === 'function') return monterComposant(v, parent, ancre, svg)
  const tag = v.type as string
  const enSvg = svg || tag === 'svg'
  const el = enSvg ? document.createElementNS(SVG, tag) : document.createElement(tag)
  v.el = el
  // un element personnalise doit etre defini pour recevoir ses proprietes
  appliquerProps(el as HTMLElement, {}, v.props, enSvg)
  const svgEnfants = enSvg && tag !== 'foreignObject'
  if (!('innerHTML' in v.props)) for (const e of v.enfants) monter(e, el, null, svgEnfants)
  parent.insertBefore(el, ancre)
  const r = v.props.ref as ((e: Element | null) => void) | undefined
  if (r) aAppeler.push(() => r(el))
}

function monterComposant(v: VNode, parent: Node, ancre: Node | null, svg: boolean) {
  const refs = new Map<string, Ref<unknown>>()
  const brutes = { ...v.props }
  const props = new Proxy(brutes, {
    get(cible, cle: string) {
      let r = refs.get(cle)
      if (!r) {
        r = ref(cible[cle])
        refs.set(cle, r)
      }
      return r.value
    },
    set() {
      return false
    }
  })
  const portee = new Portee()
  const inst: Instance = {
    id: ++numero,
    props: brutes,
    refs,
    arbre: null,
    portee,
    sale: false,
    demonte: false,
    effet: null as unknown as Effet,
    job: () => {}
  }
  v.inst = inst
  // les crochets `surMontage` de la mise en place partent APRES les `ref` du dessin (les elements sont alors connus)
  const avant = aAppeler.length
  const dessin = dans(portee, () => sansSuivi(() => (v.type as Composant<Props>)(props)))
  const crochets = aAppeler.splice(avant)
  const rendre = () => {
    const r = normaliser([dessin()])
    return r[0] ?? { type: VIDE, props: {}, enfants: [], key: undefined, el: null, inst: null }
  }
  inst.effet = new Effet(
    () => {
      const nouveau = dans(portee, rendre)
      if (!inst.arbre) {
        inst.arbre = nouveau
        monter(nouveau, parent, ancre, svg)
      } else {
        const ancien = inst.arbre
        const p = noeud(ancien).parentNode!
        inst.arbre = nouveau
        patch(ancien, nouveau, p, svg)
      }
    },
    () => {
      if (inst.demonte) return
      inst.sale = true
      planifierRendu(inst.id, inst.job)
    }
  )
  inst.job = () => {
    if (!inst.sale || inst.demonte) return
    inst.sale = false
    inst.effet.run()
    viderAppels()
  }
  inst.effet.run()
  aAppeler.push(...crochets)
}

function majProps(inst: Instance, nouv: Props): boolean {
  let change = false
  for (const k of new Set([...Object.keys(inst.props), ...Object.keys(nouv)])) {
    const v = nouv[k]
    if (Object.is(inst.props[k], v)) continue
    const avant = inst.props[k]
    inst.props[k] = v
    const r = inst.refs.get(k)
    // un gestionnaire recree a chaque dessin du parent ne redessine pas l'enfant : il est seulement remplace
    if (typeof v === 'function' && typeof avant === 'function') {
      if (r) poserSansSignal(r, v)
      continue
    }
    if (r) r.value = v
    change = true
  }
  return change
}

function demonter(v: VNode, retirer = true) {
  if (v.inst) {
    const i = v.inst
    i.demonte = true
    i.portee.arreter()
    i.effet.stop()
    if (i.arbre) demonter(i.arbre, retirer)
    return
  }
  const r = v.props.ref as ((e: Element | null) => void) | undefined
  if (r) r(null)
  for (const e of v.enfants) demonter(e, false)
  if (retirer && v.el?.parentNode) v.el.parentNode.removeChild(v.el)
}

/* --------------------------------------------------------------------- patch */

const meme = (a: VNode, b: VNode) => a.type === b.type && a.key === b.key

function patch(a: VNode, b: VNode, parent: Node, svg: boolean) {
  if (!meme(a, b)) {
    const ancre = noeud(a)
    monter(b, parent, ancre, svg)
    demonter(a)
    return
  }
  if (a.type === TEXTE) {
    b.el = a.el
    if (a.texte !== b.texte) (b.el as Text).data = b.texte!
    return
  }
  if (a.type === VIDE) {
    b.el = a.el
    return
  }
  if (typeof a.type === 'function') {
    const inst = a.inst!
    b.inst = inst
    if (majProps(inst, b.props) && inst.sale) inst.job()
    return
  }
  const el = (b.el = a.el) as HTMLElement
  const tag = b.type as string
  const enSvg = svg || tag === 'svg'
  appliquerProps(el, a.props, b.props, enSvg)
  if ('innerHTML' in b.props) return
  if ('innerHTML' in a.props) {
    el.textContent = ''
    for (const e of b.enfants) monter(e, el, null, enSvg && tag !== 'foreignObject')
    return
  }
  patchEnfants(el, a.enfants, b.enfants, enSvg && tag !== 'foreignObject')
  const ra = a.props.ref
  const rb = b.props.ref as ((e: Element | null) => void) | undefined
  if (ra !== rb) {
    ;(ra as ((e: Element | null) => void) | undefined)?.(null)
    if (rb) aAppeler.push(() => rb(el))
  }
}

function patchEnfants(el: Node, anciens: VNode[], nouveaux: VNode[], svg: boolean) {
  const parCle = new Map<unknown, VNode>()
  for (const a of anciens) if (a.key !== undefined) parCle.set(a.key, a)
  const pris = new Set<VNode>()
  const paires: (VNode | null)[] = nouveaux.map((n, i) => {
    let a: VNode | undefined
    if (n.key !== undefined) a = parCle.get(n.key)
    else {
      const x = anciens[i]
      if (x && x.key === undefined && x.type === n.type) a = x
    }
    if (a && !pris.has(a) && meme(a, n)) {
      pris.add(a)
      return a
    }
    return null
  })
  for (const a of anciens) if (!pris.has(a)) demonter(a)
  // de la fin vers le debut : chaque noeud se place juste avant le suivant
  let suivant: Node | null = null
  for (let i = nouveaux.length - 1; i >= 0; i--) {
    const n = nouveaux[i]!
    const a = paires[i]
    if (a) {
      patch(a, n, el, svg)
      const x = noeud(n)
      if (x.nextSibling !== suivant || x.parentNode !== el) el.insertBefore(x, suivant)
    } else monter(n, el, suivant, svg)
    suivant = noeud(n)
  }
}

/* --------------------------------------------------------------- proprietes */

/** Proprietes posees comme proprietes DOM (et non comme attributs). */
const PROP_DOM = new Set(['value', 'checked', 'selected', 'indeterminate', 'muted', 'innerHTML', 'textContent', 'scrollLeft'])
/** Attributs booleens : presents ou absents. */
const BOOLEENS = new Set([
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

export function classeDe(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(classeDe).filter(Boolean).join(' ')
  if (typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(' ')
  return ''
}

function styleObjet(v: unknown): Record<string, string> {
  if (!v) return {}
  if (typeof v === 'string') {
    const o: Record<string, string> = {}
    for (const d of v.split(';')) {
      const i = d.indexOf(':')
      if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
    return o
  }
  if (Array.isArray(v)) return Object.assign({}, ...v.map(styleObjet))
  const o: Record<string, string> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (x === undefined || x === null || x === false) continue
    o[k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())] = String(x)
  }
  return o
}

type Invocateur = ((e: Event) => void) & { fn?: (e: Event) => void }

function appliquerProps(el: HTMLElement, a: Props, b: Props, svg: boolean) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'key' || k === 'ref') continue
    const va = a[k]
    const vb = b[k]
    if (k === 'class') {
      const ca = classeDe(va)
      let cb = classeDe(vb)
      if (ca === cb) continue
      // classes posees a la main sur l'element (apparition au defilement) : gardees
      const garder = (el as unknown as { __garder?: string[] }).__garder
      if (garder) cb = [cb, ...garder.filter((x) => el.classList.contains(x))].filter(Boolean).join(' ')
      if (cb) el.setAttribute('class', cb)
      else el.removeAttribute('class')
      continue
    }
    if (k === 'style') {
      const sa = styleObjet(va)
      const sb = styleObjet(vb)
      for (const p of Object.keys(sa)) if (!(p in sb)) el.style.removeProperty(p)
      for (const [p, x] of Object.entries(sb)) if (sa[p] !== x || el.style.getPropertyValue(p) !== x) el.style.setProperty(p, x)
      continue
    }
    if (Object.is(va, vb) && va !== undefined && !(k in PROP_DOM_VERIF)) continue
    if (k.startsWith('on') && k.length > 2 && (typeof vb === 'function' || typeof va === 'function')) {
      const nom = k.slice(2).toLowerCase()
      const store = ((el as unknown as { _ev?: Record<string, Invocateur> })._ev ??= {})
      let inv = store[nom]
      if (typeof vb === 'function') {
        if (!inv) {
          inv = ((e: Event) => inv!.fn?.(e)) as Invocateur
          store[nom] = inv
          el.addEventListener(nom, inv)
        }
        inv.fn = vb as (e: Event) => void
      } else if (inv) {
        el.removeEventListener(nom, inv)
        delete store[nom]
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
    if (vb === null || vb === undefined || (BOOLEENS.has(k) && vb === false)) {
      el.removeAttribute(k)
      if (k === 'inert' && 'inert' in el) el.inert = false
      continue
    }
    if (k === 'inert' && 'inert' in el) el.inert = true
    el.setAttribute(k, BOOLEENS.has(k) && vb === true ? '' : String(vb))
  }
}

/** Proprietes relues sur l'element a chaque passage : l'utilisateur peut les avoir changees (champ saisi). */
const PROP_DOM_VERIF: Record<string, true> = { value: true, checked: true }

/* ------------------------------------------------------------------- racine */

const RACINES = new WeakMap<Node, VNode>()

/** Dessine `v` dans `conteneur` (son unique enfant gere), en reprenant le dessin precedent s'il y en a un. */
export function rendre(v: VNode | null, conteneur: Node, svg = false) {
  const ancien = RACINES.get(conteneur)
  if (!v) {
    if (ancien) demonter(ancien)
    RACINES.delete(conteneur)
    viderAppels()
    return
  }
  if (ancien) patch(ancien, v, conteneur, svg)
  else monter(v, conteneur, null, svg)
  RACINES.set(conteneur, v)
  viderAppels()
}

/** Monte un composant dans un element de la page ; renvoie de quoi le retirer. */
export function monterApp<P extends Props>(comp: Composant<P>, cible: Element | string, props?: P): () => void {
  const el = typeof cible === 'string' ? document.querySelector(cible) : cible
  if (!el) throw new Error(`mochi: cible introuvable ${String(cible)}`)
  rendre(h(comp as unknown as Composant<never>, props ?? {}), el)
  return () => rendre(null, el)
}
