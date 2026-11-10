import { describe, expect, it } from 'vitest'
import { DUREE_CACHE, formatEtoiles, lireCache, lireReponse } from './etoiles'

describe('etoiles GitHub', () => {
  it('format compact', () => {
    expect(formatEtoiles(0)).toBe('0')
    expect(formatEtoiles(999)).toBe('999')
    expect(formatEtoiles(1000)).toBe('1k')
    expect(formatEtoiles(1234)).toBe('1.2k')
    expect(formatEtoiles(1299)).toBe('1.2k')
    expect(formatEtoiles(15400)).toBe('15k')
  })

  it('ne lit que stargazers_count, entier positif ; sinon rien (jamais de faux nombre)', () => {
    expect(lireReponse({ stargazers_count: 42 })).toBe(42)
    expect(lireReponse({ message: 'API rate limit exceeded' })).toBeNull()
    expect(lireReponse({ stargazers_count: '42' })).toBeNull()
    expect(lireReponse({ stargazers_count: -1 })).toBeNull()
    expect(lireReponse(null)).toBeNull()
  })

  it('cache d une heure, valeur invalide ignoree', () => {
    const t = 1_000_000_000
    expect(lireCache(JSON.stringify({ n: 7, t }), t + 1000)).toBe(7)
    expect(lireCache(JSON.stringify({ n: 7, t }), t + DUREE_CACHE + 1)).toBeNull()
    expect(lireCache(JSON.stringify({ n: 'x', t }), t)).toBeNull()
    expect(lireCache('pas du json', t)).toBeNull()
    expect(lireCache(null, t)).toBeNull()
  })
})
