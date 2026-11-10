import { ref } from '@/ui/dom/reactif'

/**
 * Nombre d'etoiles GitHub du depot, lu dans le navigateur sur l'API publique de GitHub, SANS jeton (le depot est
 * public : aucun secret). Un seul appel par visite, garde une heure dans le navigateur. Si l'appel echoue, depasse la
 * limite de GitHub ou rend autre chose qu'un nombre : `null`, et la barre montre l'icone seule. Jamais de faux nombre.
 */
export const API_DEPOT = 'https://api.github.com/repos/robinnat/mochi'
export const CLE_CACHE = 'mochi:etoiles'
export const DUREE_CACHE = 60 * 60 * 1000

/** 1234 -> « 1.2k », 999 -> « 999 », 15400 -> « 15k ». */
export function formatEtoiles(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  const t = k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)
  return `${String(t).replace(/\.0$/, '')}k`
}

/** Valeur gardee si elle est recente et valide ; sinon `null`. */
export function lireCache(brut: string | null, maintenant: number): number | null {
  if (!brut) return null
  try {
    const v = JSON.parse(brut) as { n?: unknown; t?: unknown }
    if (typeof v.n !== 'number' || !Number.isInteger(v.n) || v.n < 0) return null
    if (typeof v.t !== 'number' || maintenant - v.t > DUREE_CACHE || v.t > maintenant) return null
    return v.n
  } catch {
    return null
  }
}

/** Le champ `stargazers_count` de la reponse, s'il est un entier positif ; sinon `null`. */
export function lireReponse(json: unknown): number | null {
  const n = (json as { stargazers_count?: unknown } | null)?.stargazers_count
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null
}

/** Le nombre d'etoiles, `null` tant qu'il n'est pas connu (ou s'il ne peut pas l'etre). */
export const etoiles = ref<number | null>(null)
let demande = false

/** Lance la lecture une fois par page (cache d'abord, puis l'API). Sans effet hors navigateur. */
export function chargerEtoiles(f: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch) {
  if (demande || typeof window === 'undefined' || !f) return
  demande = true
  let cache: string | null = null
  try {
    cache = localStorage.getItem(CLE_CACHE)
  } catch {
    // stockage bloque : on lit l'API sans garder
  }
  const garde = lireCache(cache, Date.now())
  if (garde !== null) {
    etoiles.value = garde
    return
  }
  f(API_DEPOT, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const n = lireReponse(json)
      if (n === null) return
      etoiles.value = n
      try {
        localStorage.setItem(CLE_CACHE, JSON.stringify({ n, t: Date.now() }))
      } catch {
        // rien a garder : on relira a la prochaine visite
      }
    })
    .catch(() => {
      // hors ligne, limite de GitHub atteinte : l'icone seule
    })
}
