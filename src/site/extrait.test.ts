import { describe, expect, it } from 'vitest'
import { extraitCode, type OptionsExtrait } from './extrait'

const base: OptionsExtrait = {
  forme: 'etoile',
  couleur: 'violet',
  rendu: '3d',
  pixel: 'moyen',
  contour: false,
  reflet: true,
  mood: 'repos'
}

describe("extrait de code du playground", () => {
  it('ne montre que ce qui differe du defaut', () => {
    expect(extraitCode(base)).toBe('<MochiBot\n  shape="etoile"\n  color="violet"\n  mood="repos"\n/>')
  })

  it('garde la taille des pixels en style Pixel (et seulement la)', () => {
    expect(extraitCode({ ...base, rendu: 'pixel3d', pixel: 'fin' })).toContain('rendu="pixel3d"\n  pixel="fin"')
    expect(extraitCode({ ...base, rendu: 'flat3d', pixel: 'fin' })).not.toContain('pixel=')
  })

  it('le contour est propre a Flat, le reflet a Soft', () => {
    expect(extraitCode({ ...base, rendu: 'flat3d', contour: true })).toContain('  contour')
    expect(extraitCode({ ...base, contour: true })).not.toContain('contour')
    expect(extraitCode({ ...base, reflet: false })).toContain(':reflet="false"')
    expect(extraitCode({ ...base, rendu: 'flat3d', reflet: false })).not.toContain('reflet')
  })

  it('montre l\'humeur et le salut', () => {
    const e = extraitCode({ ...base, mood: 'travaille', coucou: true })
    expect(e).toContain('mood="travaille"')
    expect(e).toContain('  coucou')
    expect(e.endsWith('\n/>')).toBe(true)
  })
})
