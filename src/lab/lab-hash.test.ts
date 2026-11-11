import { describe, expect, it } from 'vitest'
import { sheetOf } from './Lab'

describe('lab: the links of the menu open their sheet', () => {
  it('English hashes (the menu links) and the old French ones', () => {
    expect(sheetOf('#shapes3d')).toBe('shapes3d')
    expect(sheetOf('#formes3d')).toBe('shapes3d')
    expect(sheetOf('#turn')).toBe('turn')
    expect(sheetOf('#tour')).toBe('turn')
    expect(sheetOf('#moods')).toBe('moods')
    expect(sheetOf('#shapes')).toBe('shapes')
    expect(sheetOf('')).toBe('shapes')
  })
})
