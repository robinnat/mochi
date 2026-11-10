// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from '@/ui/dom/reactive'
import { MochiBotElement, PROPERTIES, attributeOf, readAttribute } from './mochi-bot'

/**
 * The native `<mochi-bot>` Web Component: options as attributes and properties, a host `<svg>` in the regular DOM,
 * events, methods and cleanup. happy-dom has no WebGL: like a browser without 3D, the Mochi is replaced by a short
 * message (there is no 2D drawing any more).
 */
const host = () => {
  const d = document.createElement('div')
  document.body.appendChild(d)
  return d
}
const create = (attrs: Record<string, string> = {}) => {
  const el = document.createElement('mochi-bot') as MochiBotElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('<mochi-bot> : declaration', () => {
  it('the tag is declared on import, and every option is a property', () => {
    expect(customElements.get('mochi-bot')).toBe(MochiBotElement)
    const el = create()
    for (const p of PROPERTIES) expect(p.name in el, p.name).toBe(true)
  })

  it('observes one kebab-case attribute per option (except functions)', () => {
    const obs = MochiBotElement.observedAttributes
    expect(obs).toContain('frozen-at')
    expect(obs).toContain('max-pixel-ratio')
    expect(obs).toContain('outline-width')
    expect(obs).not.toContain('gesture')
    expect(obs).not.toContain('gaze')
    expect(attributeOf('maxPixelRatio')).toBe('max-pixel-ratio')
  })

  it('reads attributes by type: number, boolean, JSON, text', () => {
    expect(readAttribute('number', '1.5')).toBe(1.5)
    expect(readAttribute('number', 'abc')).toBeUndefined()
    expect(readAttribute('boolean', '')).toBe(true)
    expect(readAttribute('boolean', 'false')).toBe(false)
    expect(readAttribute('json', '{"head":"cap"}')).toEqual({ head: 'cap' })
    expect(readAttribute('json', '{oups')).toBeUndefined()
    expect(readAttribute('text', 'star')).toBe('star')
    expect(readAttribute('text', null)).toBeUndefined()
  })
})

describe('<mochi-bot>: drawing', () => {
  it('draws an SVG in the regular DOM, at the requested size, with its alternative text', () => {
    const el = create({ size: '96', 'frozen-at': '1', label: 'Mon Mochi' })
    host().appendChild(el)
    const svg = el.querySelector('svg')!
    expect(svg).toBe(el.svg)
    expect(el.shadowRoot).toBeNull()
    expect(svg.getAttribute('width')).toBe('96')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Mon Mochi')
  })

  it('a changed option (attribute or property) redraws on the next task', async () => {
    const el = create({ shape: 'circle', 'frozen-at': '1' })
    host().appendChild(el)
    el.setAttribute('shape', 'star')
    await nextTick()
    expect(el.shape).toBe('star')
    el.size = 50
    await nextTick()
    expect(el.svg!.getAttribute('width')).toBe('50')
  })

  it("without WebGL: a message and the no3d event, no 2D fallback drawing", async () => {
    const el = create({ 'frozen-at': '1' })
    const no3d = new Promise<void>((ok) => el.addEventListener('no3d', () => ok()))
    host().appendChild(el)
    await no3d
    await nextTick()
    expect(el.svg!.querySelector('[data-no3d]')).not.toBeNull()
    expect(el.svg!.querySelector('mask, radialGradient, filter, [data-pixels]')).toBeNull()
  })

  it('removing an attribute restores the default value', async () => {
    const el = create({ size: '80', 'frozen-at': '1' })
    host().appendChild(el)
    el.removeAttribute('size')
    await nextTick()
    expect(el.size).toBe(320)
    expect(el.svg!.getAttribute('width')).toBe('320')
  })

  it('accepts objects as properties and as JSON (accessories, cycle)', () => {
    const el = create({ accessories: '{"head":"cap"}' })
    expect(el.accessories).toEqual({ head: 'cap' })
    el.accessories = { eyes: 'round' }
    expect(el.accessories).toEqual({ eyes: 'round' })
    el.cycle = [{ state: 'wink', duration: 2 }]
    expect(el.cycle).toEqual([{ state: 'wink', duration: 2 }])
  })

  it('the same image at the same frozen time: drawing is reproducible', async () => {
    const a = create({ shape: 'cloud', 'frozen-at': '1.2' })
    const b = create({ shape: 'cloud', 'frozen-at': '1.2' })
    const h = host()
    h.append(a, b)
    await nextTick()
    expect(a.svg!.outerHTML).toBe(b.svg!.outerHTML)
  })
})

describe('<mochi-bot>: player, events and methods', () => {
  it('seek moves the playhead and tells through blockchange and statechange', () => {
    const el = create({ 'frozen-at': '0' })
    el.cycle = [
      { state: 'idle', duration: 2 },
      { state: 'wink', duration: 2 }
    ]
    host().appendChild(el)
    const blocks: number[] = []
    const states: string[] = []
    el.addEventListener('blockchange', (e) => blocks.push((e as CustomEvent<number>).detail))
    el.addEventListener('statechange', (e) => states.push((e as CustomEvent<string>).detail))
    el.seek(1, 0.5)
    expect(el.block).toBe(1)
    expect(blocks).toEqual([1])
    return nextTick().then(() => {
      expect(states).toContain('wink')
      expect(el.state).toBe('wink')
    })
  })

  it('setMood, react, release and lookAt are methods of the element', () => {
    const el = create({ 'frozen-at': '1' })
    host().appendChild(el)
    expect(() => el.setMood('done')).not.toThrow()
    expect(el.react('laugh')).toBe(true)
    expect(el.react('unknown')).toBe(false)
    expect(() => el.release()).not.toThrow()
    expect(() => el.lookAt({ nx: 1, ny: -1 })).not.toThrow()
  })

  it('methods do nothing (without error) until the element is in the page', () => {
    const el = create()
    expect(() => el.seek(0)).not.toThrow()
    expect(el.react('laugh')).toBe(false)
  })
})

describe('<mochi-bot> : cycle de vie', () => {
  it('removed from the page, it stops its loop and clears its drawing', async () => {
    const cancels = vi.spyOn(window, 'cancelAnimationFrame')
    const el = create()
    const h = host()
    h.appendChild(el)
    expect(el.svg).not.toBeNull()
    el.remove()
    await Promise.resolve()
    await Promise.resolve()
    expect(cancels).toHaveBeenCalled()
    expect(el.svg).toBeNull()
    expect(el.querySelector('svg')).toBeNull()
    cancels.mockRestore()
  })

  it('moved within the page (same task), it keeps its drawing and its state', async () => {
    const el = create({ 'frozen-at': '1' })
    const a = host()
    const b = host()
    a.appendChild(el)
    const svg = el.svg
    b.appendChild(el)
    await Promise.resolve()
    await Promise.resolve()
    expect(el.svg).toBe(svg)
  })

  it('put back in the page after a removal, it redraws', async () => {
    const el = create({ 'frozen-at': '1' })
    const h = host()
    h.appendChild(el)
    el.remove()
    await Promise.resolve()
    await Promise.resolve()
    h.appendChild(el)
    expect(el.querySelector('svg')).not.toBeNull()
  })

  it('never writes the language or the title of the host page', async () => {
    document.documentElement.lang = 'en'
    document.title = 'Page hote'
    host().appendChild(create({ 'frozen-at': '1' }))
    await nextTick()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Page hote')
  })
})
