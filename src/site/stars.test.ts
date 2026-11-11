import { describe, expect, it } from 'vitest'
import { DURATION_CACHE, formatStars, readCache, readResponse, starsLabel } from './stars'

describe('etoiles GitHub', () => {
  it('format compact', () => {
    expect(formatStars(0)).toBe('0')
    expect(formatStars(999)).toBe('999')
    expect(formatStars(1000)).toBe('1k')
    expect(formatStars(1234)).toBe('1.2k')
    expect(formatStars(1299)).toBe('1.2k')
    expect(formatStars(15400)).toBe('15k')
  })

  it('says star in the singular for one', () => {
    expect(starsLabel(0)).toBe('0 stars')
    expect(starsLabel(1)).toBe('1 star')
    expect(starsLabel(2)).toBe('2 stars')
  })

  it('only reads stargazers_count, a positive integer; otherwise nothing (never a fake number)', () => {
    expect(readResponse({ stargazers_count: 42 })).toBe(42)
    expect(readResponse({ message: 'API rate limit exceeded' })).toBeNull()
    expect(readResponse({ stargazers_count: '42' })).toBeNull()
    expect(readResponse({ stargazers_count: -1 })).toBeNull()
    expect(readResponse(null)).toBeNull()
  })

  it('one hour cache, invalid value ignored', () => {
    const t = 1_000_000_000
    expect(readCache(JSON.stringify({ n: 7, t }), t + 1000)).toBe(7)
    expect(readCache(JSON.stringify({ n: 7, t }), t + DURATION_CACHE + 1)).toBeNull()
    expect(readCache(JSON.stringify({ n: 'x', t }), t)).toBeNull()
    expect(readCache('not json', t)).toBeNull()
    expect(readCache(null, t)).toBeNull()
  })
})
