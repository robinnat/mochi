import { ref } from '@/ui/dom/reactive'

/**
 * Nombre d'etoiles GitHub du depot, lu dans le navigateur sur l'API publique de GitHub, SANS jeton (le depot est
 * public : aucun secret). Un seul appel par visite, garde une heure dans le navigateur. Si l'appel echoue, depasse la
 * limite de GitHub ou rend autre chose qu'un nombre : `null`, et la barre montre l'icone seule. Jamais de faux nombre.
 */
export const API_REPO = 'https://api.github.com/repos/robinnat/mochi'
export const KEY_CACHE = 'mochi:etoiles'
export const DURATION_CACHE = 60 * 60 * 1000

/** 1234 -> « 1.2k », 999 -> « 999 », 15400 -> « 15k ». */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  const t = k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)
  return `${String(t).replace(/\.0$/, '')}k`
}

/** Valeur gardee si elle est recente et valide ; sinon `null`. */
export function readCache(raw: string | null, maintenant: number): number | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { n?: unknown; t?: unknown }
    if (typeof v.n !== 'number' || !Number.isInteger(v.n) || v.n < 0) return null
    if (typeof v.t !== 'number' || maintenant - v.t > DURATION_CACHE || v.t > maintenant) return null
    return v.n
  } catch {
    return null
  }
}

/** Le champ `stargazers_count` de la reponse, s'il est un entier positif ; sinon `null`. */
export function readResponse(json: unknown): number | null {
  const n = (json as { stargazers_count?: unknown } | null)?.stargazers_count
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null
}

/** Le nombre d'etoiles, `null` tant qu'il n'est pas connu (ou s'il ne peut pas l'etre). */
export const stars = ref<number | null>(null)
let request = false

/** Lance la lecture une fois par page (cache d'abord, puis l'API). Sans effet hors navigateur. */
export function loadStars(f: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch) {
  if (request || typeof window === 'undefined' || !f) return
  request = true
  let cache: string | null = null
  try {
    cache = localStorage.getItem(KEY_CACHE)
  } catch {
    // stockage bloque : on lit l'API sans garder
  }
  const kept = readCache(cache, Date.now())
  if (kept !== null) {
    stars.value = kept
    return
  }
  f(API_REPO, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const n = readResponse(json)
      if (n === null) return
      stars.value = n
      try {
        localStorage.setItem(KEY_CACHE, JSON.stringify({ n, t: Date.now() }))
      } catch {
        // rien a garder : on relira a la prochaine visite
      }
    })
    .catch(() => {
      // hors ligne, limite de GitHub atteinte : l'icone seule
    })
}
