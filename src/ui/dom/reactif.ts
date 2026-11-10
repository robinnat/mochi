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

type Dep = Set<Effet>

let effetCourant: Effet | null = null

export class Effet {
  deps = new Set<Dep>()
  actif = true
  constructor(
    public fn: () => unknown,
    public ordonnanceur?: () => void
  ) {}

  run<T>(): T {
    if (!this.actif) return this.fn() as T
    this.nettoyer()
    const avant = effetCourant
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    effetCourant = this
    try {
      return this.fn() as T
    } finally {
      effetCourant = avant
    }
  }

  nettoyer() {
    for (const d of this.deps) d.delete(this)
    this.deps.clear()
  }

  stop() {
    this.nettoyer()
    this.actif = false
  }
}

function suivre(dep: Dep) {
  if (!effetCourant) return
  dep.add(effetCourant)
  effetCourant.deps.add(dep)
}

function declencher(dep: Dep) {
  for (const e of [...dep]) {
    // un effet qui modifie ce qu'il lit ne se relance pas lui-meme
    if (e === effetCourant) continue
    if (e.ordonnanceur) e.ordonnanceur()
    else e.run()
  }
}

/**
 * Execute `fn` sans que ses lectures soient suivies par l'effet en cours. Les effets crees dedans (un `watch`,
 * un `computed`) suivent normalement leurs propres lectures.
 */
export function sansSuivi<T>(fn: () => T): T {
  const avant = effetCourant
  effetCourant = null
  try {
    return fn()
  } finally {
    effetCourant = avant
  }
}

/* ----------------------------------------------------------------------- ref */

const EST_REF = Symbol('ref')

class RefImpl<T> {
  readonly [EST_REF] = true
  dep: Dep = new Set()
  /** incremente a chaque changement : `watch` s'en sert pour savoir qu'une source a bouge */
  version = 0
  constructor(
    private v: T,
    readonly superficielle = false
  ) {}
  get value(): T {
    suivre(this.dep)
    return this.v
  }
  set value(n: T) {
    if (Object.is(n, this.v)) return
    this.v = n
    this.version++
    declencher(this.dep)
  }
}

export function ref<T>(valeur: T): Ref<T>
export function ref<T = undefined>(): Ref<T | undefined>
export function ref<T>(valeur?: T): Ref<T | undefined> {
  return new RefImpl(valeur)
}

/**
 * Comme `ref`, mais un `watch` qui l'observe se relance a CHAQUE signal, meme si l'objet garde est le
 * meme : c'est ce qui permet de muter une image en place puis de prevenir avec `triggerRef`.
 */
export function shallowRef<T>(valeur: T): Ref<T> {
  return new RefImpl(valeur, true)
}

/** Previent les lecteurs d'une ref sans changer sa valeur (apres une mutation en place). */
export function triggerRef(r: Ref<unknown>) {
  const i = r as unknown as RefImpl<unknown>
  i.version++
  declencher(i.dep)
}

export const isRef = (v: unknown): v is Ref<unknown> => !!v && typeof v === 'object' && EST_REF in v

/* ------------------------------------------------------------------ computed */

class Calcule<T> {
  readonly [EST_REF] = true
  dep: Dep = new Set()
  private sale = true
  private v!: T
  private effet: Effet
  constructor(
    getter: () => T,
    private setter?: (v: T) => void
  ) {
    this.effet = new Effet(getter, () => {
      if (this.sale) return
      this.sale = true
      declencher(this.dep)
    })
    enregistrerNettoyage(() => this.effet.stop())
  }
  get value(): T {
    suivre(this.dep)
    if (this.sale) {
      this.sale = false
      this.v = this.effet.run<T>()
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
  return typeof g === 'function' ? new Calcule(g) : new Calcule(g.get, g.set)
}

/* ------------------------------------------------------------------ file */

type Job = () => void
const fileAvant: Job[] = []
const fileRendu: { id: number; job: Job }[] = []
const fileApres: Job[] = []
let prevu = false
let enCours: Promise<void> | null = null
const resolue = Promise.resolve()

function lancer() {
  if (prevu) return
  prevu = true
  enCours = resolue.then(vider)
}

function vider() {
  try {
    let tours = 0
    while (fileAvant.length || fileRendu.length || fileApres.length) {
      // garde-fou : une boucle de reactions qui ne converge pas ne doit pas figer la page
      if (++tours > 1000) {
        console.error('mochi: reactions sans fin, file videe')
        fileAvant.length = fileRendu.length = fileApres.length = 0
        break
      }
      while (fileAvant.length) fileAvant.shift()!()
      if (fileRendu.length) {
        // parents d'abord : un parent rendu met a jour ses enfants dans la foulee
        fileRendu.sort((a, b) => a.id - b.id)
        while (fileRendu.length) fileRendu.shift()!.job()
        continue
      }
      while (fileApres.length && !fileAvant.length && !fileRendu.length) fileApres.shift()!()
    }
  } finally {
    prevu = false
    enCours = null
  }
}

export type Flush = 'pre' | 'post' | 'sync'

export function planifier(job: Job, flush: Flush = 'pre') {
  if (flush === 'sync') return job()
  const f = flush === 'post' ? fileApres : fileAvant
  if (!f.includes(job)) f.push(job)
  lancer()
}

/** File des rendus de composants, triee par numero d'ordre (un parent est cree avant ses enfants). */
export function planifierRendu(id: number, job: Job) {
  if (!fileRendu.some((x) => x.job === job)) fileRendu.push({ id, job })
  lancer()
}

/** Attend que les reactions en attente (observateurs, rendus) aient toutes ete jouees. */
export function nextTick<T = void>(fn?: () => T): Promise<T> {
  const p = enCours ?? resolue
  return (fn ? p.then(fn) : p) as Promise<T>
}

/* ------------------------------------------------------------- nettoyage */

/**
 * Portee de nettoyage : tout ce qui est cree pendant `dans(portee, ...)` (observateurs, valeurs
 * calculees, `surNettoyage`) est arrete par `portee.arreter()`. Les composants en ouvrent une
 * chacun ; en dehors (module charge une fois), rien n'est jamais arrete, et c'est voulu.
 */
export class Portee {
  private fns: (() => void)[] = []
  ajouter(fn: () => void) {
    this.fns.push(fn)
  }
  arreter() {
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

let porteeCourante: Portee | null = null

export function dans<T>(p: Portee | null, fn: () => T): T {
  const avant = porteeCourante
  porteeCourante = p
  try {
    return fn()
  } finally {
    porteeCourante = avant
  }
}

export const porteeActive = () => porteeCourante

function enregistrerNettoyage(fn: () => void) {
  porteeCourante?.ajouter(fn)
}

/** Fonction appelee quand la portee courante (le composant) s'arrete. */
export function surNettoyage(fn: () => void) {
  enregistrerNettoyage(fn)
}

/* --------------------------------------------------------------------- watch */

export interface OptionsWatch {
  immediate?: boolean
  flush?: Flush
}

const INIT = Symbol('init')

type Valeurs<S> = { [K in keyof S]: S[K] extends Source<infer V> ? V : never }

export function watch<T>(source: Source<T>, cb: (v: T, avant: T | undefined) => void, o?: OptionsWatch): () => void
export function watch<S extends readonly Source<unknown>[]>(
  sources: readonly [...S],
  cb: (v: Valeurs<S>, avant: Valeurs<S> | undefined) => void,
  o?: OptionsWatch
): () => void
export function watch(
  source: Source<unknown> | readonly Source<unknown>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (v: any, avant: any) => void,
  o: OptionsWatch = {}
): () => void {
  const lire = (s: Source<unknown>) => (typeof s === 'function' ? s() : s.value)
  const liste = Array.isArray(source)
  const getter = liste ? () => (source as Source<unknown>[]).map(lire) : () => lire(source as Source<unknown>)
  const sources = (liste ? source : [source]) as Source<unknown>[]
  // comme une `shallowRef` se signale aussi sans changer de valeur, sa presence force le rappel
  const force = sources.some((s) => s instanceof RefImpl && s.superficielle)
  let avant: unknown = INIT
  const job = () => {
    if (!effet.actif) return
    const v = effet.run()
    const change =
      avant === INIT ||
      force ||
      (liste ? (v as unknown[]).some((x, i) => !Object.is(x, (avant as unknown[])[i])) : !Object.is(v, avant))
    if (!change) return
    const a = avant === INIT ? undefined : avant
    avant = v
    cb(v, a)
  }
  const effet = new Effet(getter, () => planifier(job, o.flush))
  if (o.immediate) job()
  else avant = effet.run()
  const stop = () => effet.stop()
  enregistrerNettoyage(stop)
  return stop
}

/** Effet relance (en file) a chaque changement de ce qu'il lit ; le premier passage est immediat. */
export function watchEffect(fn: () => void, o: { flush?: Flush } = {}): () => void {
  const effet = new Effet(fn, () => planifier(job, o.flush))
  const job = () => {
    if (effet.actif) effet.run()
  }
  effet.run()
  const stop = () => effet.stop()
  enregistrerNettoyage(stop)
  return stop
}

/**
 * Une valeur lue et ecrite ailleurs, presentee comme une ref : typiquement une prop d'un composant et la
 * fonction qui previent le parent (`lien(() => props.open, (v) => props.onOpen(v))`).
 */
export function lien<T>(lire: () => T, ecrire: (v: T) => void): Ref<T> {
  return {
    get value() {
      return lire()
    },
    set value(v: T) {
      ecrire(v)
    }
  }
}

/** Change la valeur d'une ref SANS prevenir ses lecteurs (un gestionnaire d'evenement neuf mais equivalent). */
export function poserSansSignal<T>(r: Ref<T>, v: T) {
  ;(r as unknown as { v: T }).v = v
}
