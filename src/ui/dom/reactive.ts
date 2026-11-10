/**
 * Minimal reactivity, with no dependency: `ref`, `computed`, `watch`, `watchEffect`, `nextTick`.
 *
 * That is all the site, the app and the `<mochi-bot>` component need to track a state and only redo what depends on
 * what changed. It works the classic way, "an effect reads values, values notify their readers":
 *
 * - a `ref` keeps a value and the list of effects that read it;
 * - an effect reads its sources again on each pass, which keeps its dependency list up to date;
 * - reactions (`watch`, component rendering) do not run at once: they are queued and played together at the end of
 *   the
 *   current task (microtask), in this order: ordinary watchers, then renders (parents before children), then
 *   `flush: 'post'` watchers, which therefore see the updated DOM. `nextTick()` waits for the end of that queue.
 *
 * Names and behavior deliberately follow common usage (a `ref` has a `.value`), so the code using it reads without
 * docs.
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
    // an effect that changes what it reads does not rerun itself
    if (e === effectCurrent) continue
    if (e.scheduler) e.scheduler()
    else e.run()
  }
}

/**
 * Runs `fn` without its reads being tracked by the current effect. Effects created inside (a `watch`, a `computed`)
 * track their own reads normally.
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
  /** incremented on each change: `watch` uses it to know a source moved */
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
 * Like `ref`, but a `watch` observing it reruns on EVERY signal, even if the kept object is the same: that lets you
 * mutate an image in place then notify with `triggerRef`.
 */
export function shallowRef<T>(value: T): Ref<T> {
  return new RefImpl(value, true)
}

/** Notifies a ref's readers without changing its value (after an in-place mutation). */
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
      // guard: a loop of reactions that does not converge must not freeze the page
      if (++turns > 1000) {
        console.error('mochi: reactions sans fin, file videe')
        fileBefore.length = fileRender.length = fileAfter.length = 0
        break
      }
      while (fileBefore.length) fileBefore.shift()!()
      if (fileRender.length) {
        // parents first: a rendered parent updates its children right away
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

/** Queue of component renders, sorted by order number (a parent is created before its children). */
export function scheduleRender(id: number, job: Job) {
  if (!fileRender.some((x) => x.job === job)) fileRender.push({ id, job })
  lancer()
}

/** Waits until pending reactions (watchers, renders) have all run. */
export function nextTick<T = void>(fn?: () => T): Promise<T> {
  const p = enCours ?? resolue
  return (fn ? p.then(fn) : p) as Promise<T>
}

/* ------------------------------------------------------------- nettoyage */

/**
 * Cleanup scope: everything created during `within(scope, ...)` (watchers, computed values, `onCleanup`) is stopped
 * by `scope.stop()`. Each component opens one; outside (a module loaded once), nothing is ever stopped, on purpose.
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

/** Function called when the current scope (the component) stops. */
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
  // since a `shallowRef` also signals without changing value, its presence forces the call
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

/** Effect rerun (queued) on each change of what it reads; the first pass is immediate. */
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
 * A value read and written elsewhere, shown as a ref: typically a component prop and the function that notifies the
 * parent (`link(() => props.open, (v) => props.onOpen(v))`).
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

/** Changes a ref's value WITHOUT notifying its readers (a new but equivalent event handler). */
export function setWithoutSignal<T>(r: Ref<T>, v: T) {
  ;(r as unknown as { v: T }).v = v
}
