import { describe, expect, it } from 'vitest'
import { accessoriesAsCode, extraitCode, type OptionsExtrait } from './excerpt'

const base: OptionsExtrait = {
  shape: 'star',
  color: 'violet',
  renderStyle: '3d',
  mood: 'idle',
  accessories: {},
  theme: 'auto',
  laptop: true
}

describe('code excerpt of the customization', () => {
  it('is a complete <mochi-bot> tag that only shows what differs from the default', () => {
    const e = extraitCode(base)
    expect(e).toBe('<mochi-bot\n  shape="star"\n  color="violet"\n  mood="idle"\n  size="260"\n></mochi-bot>')
    for (const absent of ['render-style=', 'outline', 'shading', 'thickness', 'accessories', 'theme', 'laptop']) expect(e).not.toContain(absent)
  })

  it('never writes the removed options (outline, highlight) nor shading, in any style', () => {
    for (const renderStyle of ['3d', 'flat3d', 'pixel3d'] as const) {
      const e = extraitCode({ ...base, renderStyle })
      for (const absent of ['outline', 'highlight', 'shading']) expect(e).not.toContain(absent)
    }
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).toContain('render-style="pixel3d"')
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).not.toContain('pixel=')
  })

  it('theme, laptop of the working mood and accessories with their colors', () => {
    const e = extraitCode({
      ...base,
      mood: 'working',
      laptop: false,
      theme: 'dark',
      accessories: { head: { id: 'cap', c1: '#2f6fe0', c2: '#ff3b30' }, eyes: { id: 'round', c1: '#26222f', c2: '#26222f' } }
    })
    expect(e).toContain('mood="working"')
    expect(e).toContain('laptop="false"')
    expect(e).toContain('theme="dark"')
    expect(e).toContain(`accessories='{"head":{"id":"cap","c1":"#2f6fe0"},"eyes":"round"}'`)
    // the attribute is valid JSON, read as is by the component
    const json = e.match(/accessories='([^']+)'/)![1]!
    expect(JSON.parse(json)).toEqual({ head: { id: 'cap', c1: '#2f6fe0' }, eyes: 'round' })
    // the laptop is only written for the working mood
    expect(extraitCode({ ...base, laptop: false })).not.toContain('laptop')
  })

  it('accessoriesAsCode: empty without an accessory, id alone with the catalog colors', () => {
    expect(accessoriesAsCode({})).toBe('')
    expect(accessoriesAsCode({ neck: 'bowtie', back: 'cape' })).toBe("{ neck: 'bowtie', back: 'cape' }")
  })

  it('free color: the code writes the chosen hex, and nothing else', () => {
    const free: OptionsExtrait = { shape: 'heart', color: '#ff8800', renderStyle: 'pixel3d', mood: 'idle', accessories: {}, theme: 'auto', laptop: true }
    const e = extraitCode(free)
    expect(e).toContain('color="#ff8800"')
    expect(e).toContain('shape="heart"')
    for (const absent of ['outline', 'thickness', 'highlight']) expect(e).not.toContain(absent)
    expect(extraitCode({ ...free, renderStyle: '3d' })).not.toContain('highlight')
  })
})
