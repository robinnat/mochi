import { ref } from '@/ui/dom/reactive'

/**
 * GitHub star count of the repository, read in the browser from GitHub's public API, WITHOUT a token (the repository
 * is public: no secret). A single call per visit, kept one hour in the browser. If the call fails, hits GitHub's
 * limit or returns something else than a number: `null`, and the bar shows the icon alone. Never a fake number.
 */
export const API_REPO = 'https://api.github.com/repos/robinnat/mochiz'
export const KEY_CACHE = 'mochi:stars'
export const DURATION_CACHE = 60 * 60 * 1000

/** 1234 -> « 1.2k », 999 -> « 999 », 15400 -> « 15k ». */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  const t = k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)
  return `${String(t).replace(/\.0$/, '')}k`
}

/** What a screen reader hears: « 1 star », « 0 stars », « 42 stars ». */
export function starsLabel(n: number): string {
  return `${n} ${n === 1 ? 'star' : 'stars'}`
}

/** Kept value if it is recent and valid; otherwise `null`. */
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

/** The `stargazers_count` field of the response, if it is a positive integer; otherwise `null`. */
export function readResponse(json: unknown): number | null {
  const n = (json as { stargazers_count?: unknown } | null)?.stargazers_count
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null
}

/** The star count, `null` until it is known (or if it cannot be). */
export const stars = ref<number | null>(null)
let request = false

/** Starts the read once per page (cache first, then the API). No effect outside a browser. */
export function loadStars(f: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch) {
  if (request || typeof window === 'undefined' || !f) return
  request = true
  let cache: string | null = null
  try {
    cache = localStorage.getItem(KEY_CACHE)
  } catch {
    // storage blocked: read the API without keeping it
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
        // nothing to keep: read again on the next visit
      }
    })
    .catch(() => {
      // offline, GitHub limit reached: the icon alone
    })
}
