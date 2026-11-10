import { describe, expect, it } from 'vitest'
import { accessoriesAsCode, extraitCode, type OptionsExtrait } from './excerpt'

const base: OptionsExtrait = {
  shape: 'star',
  color: 'violet',
  renderStyle: '3d',
  outline: false,
  highlight: true,
  mood: 'idle',
  accessories: {},
  theme: 'auto',
  laptop: true
}

describe('code excerpt of the customization', () => {
  it('is a complete <mochi-bot> tag that only shows what differs from the default', () => {
    const e = extraitCode(base)
    expect(e).toBe('<mochi-bot\n  shape="star"\n  color="violet"\n  mood="idle"\n  size="260"\n></mochi-bot>')
    for (const absent of ['rendu=', 'outline', 'shading', 'thickness', 'accessories', 'theme', 'laptop']) expect(e).not.toContain(absent)
  })

  it('the outline applies to all three styles, the highlight only to Soft, no shading any more', () => {
    for (const renderStyle of ['3d', 'flat3d', 'pixel3d'] as const) expect(extraitCode({ ...base, renderStyle, outline: true })).toContain('contour')
    expect(extraitCode(base)).not.toContain('shading')
    expect(extraitCode({ ...base, highlight: false })).toContain('reflet="false"')
    expect(extraitCode({ ...base, renderStyle: 'flat3d', highlight: false })).not.toContain('highlight')
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).toContain('rendu="pixel3d"')
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).not.toContain('pixel=')
  })

  it('the outline width is written only if it differs from the default and the outline is on', () => {
    expect(extraitCode({ ...base, outline: true, thickness: 1 })).not.toContain('thickness')
    expect(extraitCode({ ...base, outline: true, thickness: 2.5 })).toContain('  outline-width="2.5"')
    expect(extraitCode({ ...base, outline: false, thickness: 2.5 })).not.toContain('thickness')
  })

  it('theme, laptop of the working mood and accessories with their colors', () => {
    const e = extraitCode({
      ...base,
      mood: 'working',
      laptop: false,
      theme: 'dark',
      accessories: { head: { id: 'cap', c1: '#2f6fe0', c2: '#ff3b30' }, eyes: { id: 'round', c1: '#26222f', c2: '#26222f' } }
    })
    expect(e).toContain('mood="travaille"')
    expect(e).toContain('ordinateur="false"')
    expect(e).toContain('theme="dark"')
    expect(e).toContain(`accessories='{"head":{"id":"cap","c1":"#2f6fe0"},"eyes":"round"}'`)
    // the attribute is valid JSON, read as is by the component
    const json = e.match(/accessoires='([^']+)'/)![1]!
    expect(JSON.parse(json)).toEqual({ head: { id: 'cap', c1: '#2f6fe0' }, eyes: 'round' })
    // the laptop is only written for the working mood
    expect(extraitCode({ ...base, laptop: false })).not.toContain('laptop')
  })

  it('accessoriesAsCode: empty without an accessory, id alone with the catalog colors', () => {
    expect(accessoriesAsCode({})).toBe('')
    expect(accessoriesAsCode({ neck: 'bowtie', back: 'cape' })).toBe("{ bas: 'papillon', dos: 'cape' }")
  })

  it('free color: the code writes the chosen hex, without outline or highlight when the site does not pass them', () => {
    const free: OptionsExtrait = { shape: 'heart', color: '#ff8800', renderStyle: 'pixel3d', mood: 'idle', accessories: {}, theme: 'auto', laptop: true }
    const e = extraitCode(free)
    expect(e).toContain('color="#ff8800"')
    expect(e).toContain('shape="coeur"')
    for (const absent of ['outline', 'thickness', 'highlight']) expect(e).not.toContain(absent)
    expect(extraitCode({ ...free, renderStyle: '3d' })).not.toContain('highlight')
  })
})
