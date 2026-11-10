/**
 * Reactivite minimale, sans dependance : `ref`, `computed`, `watch`, `watchEffect`, `nextTick`.
 *
 * C'est tout ce dont le site, l'application et le composant `<mochi-bot>` ont besoin pour suivre
 * un etat et ne refaire que ce qui depend de ce qui a change. Le fonctionnement est le classique
 * « effet qui lit des valeurs, valeurs qui previennent leurs lecteurs » :
 *
 * - une `ref` garde une valeur et la liste des effets qui l'ont lue ;
 * - un effet relit ses sources a chaque passage, ce qui tient sa liste de dependances a jour ;
 * - les reactions (`watch`, rendu des composants) ne partent pas tout de suite : elles sont mises
 *   en file et jouees ensemble a la fin de la tache courante (microtache), dans cet ordre : les
 *   observateurs ordinaires, puis les rendus (parents avant enfants), puis les observateurs
 *   `flush: 'post'`, qui voient donc le DOM a jour. `nextTick()` attend la fin de cette file.
 *
 * Les noms et le comportement suivent volontairement l'usage courant (une `ref` a un `.value`),
 * pour que le code qui s'en sert se lise sans documentation.
 */

export interface Ref<T> {
  value: T
}
export type ReadonlyRef<T> = { readonly value: T }
type Source<T> = Ref<T> | ReadonlyRef<T> | (() => T)

type Dep = Set<Effect>

let effectCurrent: Effect | null = null

export class Effect {
  deps = new Set<Dep>()
  active = true
  constructor(
    public fn: () => unknown,
    public scheduler?: () => void
  ) {}

  run<T>(): T {
    if (!this.active) return this.fn() as T
    this.clean()
    const before = effectCurrent
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    effectCurrent = this
    try {
      return this.fn() as T
    } finally {
      effectCurrent = before
    }
  }

  clean() {
    for (const d of this.deps) d.delete(this)
    this.deps.clear()
  }

  stop() {
    this.clean()
    this.active = false
  }
}

function follow(dep: Dep) {
  if (!effectCurrent) return
  dep.add(effectCurrent)
  effectCurrent.deps.add(dep)
}

function trigger(dep: Dep) {
  for (const e of [...dep]) {
    // un effet qui modifie ce qu'il lit ne se relance pas lui-meme
    if (e === effectCurrent) continue
    if (e.scheduler) e.scheduler()
    else e.run()
  }
}

/**
 * Execute `fn` sans que ses lectures soient suivies par l'effet en cours. Les effets crees dedans (un `watch`,
 * un `computed`) suivent normalement leurs propres lectures.
 */
export function untracked<T>(fn: () => T): T {
  const before = effectCurrent
  effectCurrent = null
  try {
    return fn()
  } finally {
    effectCurrent = before
  }
}

/* ----------------------------------------------------------------------- ref */

const IS_REF = Symbol('ref')

class RefImpl<T> {
  readonly [IS_REF] = true
  dep: Dep = new Set()
  /** incremente a chaque changement : `watch` s'en sert pour savoir qu'une source a bouge */
  version = 0
  constructor(
    private v: T,
    readonly superficielle = false
  ) {}
  get value(): T {
    follow(this.dep)
    return this.v
  }
  set value(n: T) {
    if (Object.is(n, this.v)) return
    this.v = n
    this.version++
    trigger(this.dep)
  }
}

export function ref<T>(value: T): Ref<T>
export function ref<T = undefined>(): Ref<T | undefined>
export function ref<T>(value?: T): Ref<T | undefined> {
  return new RefImpl(value)
}

/**
 * Comme `ref`, mais un `watch` qui l'observe se relance a CHAQUE signal, meme si l'objet garde est le
 * meme : c'est ce qui permet de muter une image en place puis de prevenir avec `triggerRef`.
 */
export function shallowRef<T>(value: T): Ref<T> {
  return new RefImpl(value, true)
}

/** Previent les lecteurs d'une ref sans changer sa valeur (apres une mutation en place). */
export function triggerRef(r: Ref<unknown>) {
  const i = r as unknown as RefImpl<unknown>
  i.version++
  trigger(i.dep)
}

export const isRef = (v: unknown): v is Ref<unknown> => !!v && typeof v === 'object' && IS_REF in v

/* ------------------------------------------------------------------ computed */

class Computed<T> {
  readonly [IS_REF] = true
  dep: Dep = new Set()
  private sale = true
  private v!: T
  private effect: Effect
  constructor(
    getter: () => T,
    private setter?: (v: T) => void
  ) {
    this.effect = new Effect(getter, () => {
      if (this.sale) return
      this.sale = true
      trigger(this.dep)
    })
    saveCleanup(() => this.effect.stop())
  }
  get value(): T {
    follow(this.dep)
    if (this.sale) {
      this.sale = false
      this.v = this.effect.run<T>()
    }
    return this.v
  }
  set value(n: T) {
    this.setter?.(n)
  }
}

export function computed<T>(getter: () => T): ReadonlyRef<T>
export function computed<T>(options: { get: () => T; set: (v: T) => void }): Ref<T>
export function computed<T>(g: (() => T) | { get: () => T; set: (v: T) => void }): Ref<T> {
  return typeof g === 'function' ? new Computed(g) : new Computed(g.get, g.set)
}

/* ------------------------------------------------------------------ file */

type Job = () => void
const fileBefore: Job[] = []
const fileRender: { id: number; job: Job }[] = []
const fileAfter: Job[] = []
let planned = false
let enCours: Promise<void> | null = null
const resolue = Promise.resolve()

function lancer() {
  if (planned) return
  planned = true
  enCours = resolue.then(clear)
}

function clear() {
  try {
    let turns = 0
    while (fileBefore.length || fileRender.length || fileAfter.length) {
      // garde-fou : une boucle de reactions qui ne converge pas ne doit pas figer la page
      if (++turns > 1000) {
        console.error('mochi: reactions sans fin, file videe')
        fileBefore.length = fileRender.length = fileAfter.length = 0
        break
      }
      while (fileBefore.length) fileBefore.shift()!()
      if (fileRender.length) {
        // parents d'abord : un parent rendu met a jour ses enfants dans la foulee
        fileRender.sort((a, b) => a.id - b.id)
        while (fileRender.length) fileRender.shift()!.job()
        continue
      }
      while (fileAfter.length && !fileBefore.length && !fileRender.length) fileAfter.shift()!()
    }
  } finally {
    planned = false
    enCours = null
  }
}

export type Flush = 'pre' | 'post' | 'sync'

export function schedule(job: Job, flush: Flush = 'pre') {
  if (flush === 'sync') return job()
  const f = flush === 'post' ? fileAfter : fileBefore
  if (!f.includes(job)) f.push(job)
  lancer()
}

/** File des rendus de composants, triee par numero d'ordre (un parent est cree avant ses enfants). */
export function scheduleRender(id: number, job: Job) {
  if (!fileRender.some((x) => x.job === job)) fileRender.push({ id, job })
  lancer()
}

/** Attend que les reactions en attente (observateurs, rendus) aient toutes ete jouees. */
export function nextTick<T = void>(fn?: () => T): Promise<T> {
  const p = enCours ?? resolue
  return (fn ? p.then(fn) : p) as Promise<T>
}

/* ------------------------------------------------------------- nettoyage */

/**
 * Portee de nettoyage : tout ce qui est cree pendant `within(scope, ...)` (observateurs, valeurs
 * calculees, `onCleanup`) est arrete par `scope.stop()`. Les composants en ouvrent une
 * chacun ; en dehors (module charge une fois), rien n'est jamais arrete, et c'est voulu.
 */
export class Scope {
  private fns: (() => void)[] = []
  add(fn: () => void) {
    this.fns.push(fn)
  }
  stop() {
    const fns = this.fns
    this.fns = []
    for (const f of fns.reverse()) {
      try {
        f()
      } catch (e) {
        console.error(e)
      }
    }
  }
}

let scopeCurrent: Scope | null = null

export function within<T>(p: Scope | null, fn: () => T): T {
  const before = scopeCurrent
  scopeCurrent = p
  try {
    return fn()
  } finally {
    scopeCurrent = before
  }
}

export const scopeActive = () => scopeCurrent

function saveCleanup(fn: () => void) {
  scopeCurrent?.add(fn)
}

/** Fonction appelee quand la portee courante (le composant) s'arrete. */
export function onCleanup(fn: () => void) {
  saveCleanup(fn)
}

/* --------------------------------------------------------------------- watch */

export interface OptionsWatch {
  immediate?: boolean
  flush?: Flush
}

const INIT = Symbol('init')

type Values<S> = { [K in keyof S]: S[K] extends Source<infer V> ? V : never }

export function watch<T>(source: Source<T>, cb: (v: T, before: T | undefined) => void, o?: OptionsWatch): () => void
export function watch<S extends readonly Source<unknown>[]>(
  sources: readonly [...S],
  cb: (v: Values<S>, before: Values<S> | undefined) => void,
  o?: OptionsWatch
): () => void
export function watch(
  source: Source<unknown> | readonly Source<unknown>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (v: any, before: any) => void,
  o: OptionsWatch = {}
): () => void {
  const read = (s: Source<unknown>) => (typeof s === 'function' ? s() : s.value)
  const list = Array.isArray(source)
  const getter = list ? () => (source as Source<unknown>[]).map(read) : () => read(source as Source<unknown>)
  const sources = (list ? source : [source]) as Source<unknown>[]
  // comme une `shallowRef` se signale aussi sans changer de valeur, sa presence force le rappel
  const force = sources.some((s) => s instanceof RefImpl && s.superficielle)
  let before: unknown = INIT
  const job = () => {
    if (!effect.active) return
    const v = effect.run()
    const change =
      before === INIT ||
      force ||
      (list ? (v as unknown[]).some((x, i) => !Object.is(x, (before as unknown[])[i])) : !Object.is(v, before))
    if (!change) return
    const a = before === INIT ? undefined : before
    before = v
    cb(v, a)
  }
  const effect = new Effect(getter, () => schedule(job, o.flush))
  if (o.immediate) job()
  else before = effect.run()
  const stop = () => effect.stop()
  saveCleanup(stop)
  return stop
}

/** Effet relance (en file) a chaque changement de ce qu'il lit ; le premier passage est immediat. */
export function watchEffect(fn: () => void, o: { flush?: Flush } = {}): () => void {
  const effect = new Effect(fn, () => schedule(job, o.flush))
  const job = () => {
    if (effect.active) effect.run()
  }
  effect.run()
  const stop = () => effect.stop()
  saveCleanup(stop)
  return stop
}

/**
 * Une valeur lue et ecrite ailleurs, presentee comme une ref : typiquement une prop d'un composant et la
 * fonction qui previent le parent (`link(() => props.open, (v) => props.onOpen(v))`).
 */
export function link<T>(read: () => T, write: (v: T) => void): Ref<T> {
  return {
    get value() {
      return read()
    },
    set value(v: T) {
      write(v)
    }
  }
}

/** Change la valeur d'une ref SANS prevenir ses lecteurs (un gestionnaire d'evenement neuf mais equivalent). */
export function setWithoutSignal<T>(r: Ref<T>, v: T) {
  ;(r as unknown as { v: T }).v = v
}
