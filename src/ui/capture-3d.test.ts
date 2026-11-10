// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { freezeCanvases, svgStandalone } from './capture'

/**
 * Export of a still image in real 3D (the default style).
 *
 * The 3D draws the body in a WebGL canvas placed in a `<foreignObject>`. Serialized as is, that node tainted the
 * rasterization canvas: `toBlob` failed with `SecurityError` and the PNG export showed "Export failed". And the SVG
 * file shipped an empty canvas (`cloneNode` does not copy pixels). happy-dom rasterizes nothing: so we lock what
 * makes rasterization safe, the SVG itself.
 */

const NS = 'http://www.w3.org/2000/svg'
const PIXELS = 'data:image/png;base64,iVBORw0KGgo='

function svg3d(pixel = false) {
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
  svg.setAttribute('viewBox', '-158 -158 316 316')
  svg.setAttribute('class', 'h-full w-full')
  const ring = document.createElementNS(NS, 'path')
  ring.setAttribute('d', 'M0 0L1 1')
  svg.appendChild(ring)
  const fo = document.createElementNS(NS, 'foreignObject')
  for (const [k, v] of Object.entries({ x: '-158', y: '-158', width: '316', height: '316' })) fo.setAttribute(k, v)
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  if (pixel) canvas.style.imageRendering = 'pixelated'
  fo.appendChild(canvas)
  svg.appendChild(fo)
  document.body.appendChild(svg)
  return { svg, canvas }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('export fixe en vraie 3D', () => {
  it('the exported SVG no longer holds a foreignObject or a canvas, but a data: image of the rendered body', () => {
    const { svg, canvas } = svg3d()
    const lu = vi.spyOn(canvas, 'toDataURL').mockReturnValue(PIXELS)
    const markup = svgStandalone(svg, 1024)
    expect(lu).toHaveBeenCalledWith('image/png')
    expect(markup).not.toContain('foreignObject')
    expect(markup).not.toContain('<canvas')
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const img = doc.querySelector('image')!
    expect(img).not.toBeNull()
    expect(img.getAttribute('href')).toBe(PIXELS)
    // placed exactly where the canvas was
    expect([img.getAttribute('x'), img.getAttribute('y'), img.getAttribute('width'), img.getAttribute('height')]).toEqual([
      '-158',
      '-158',
      '316',
      '316'
    ])
    // the rest of the drawing (rings) is intact
    expect(doc.querySelector('path')).not.toBeNull()
  })

  it('the displayed node is not touched: only the clone is frozen', () => {
    const { svg, canvas } = svg3d()
    vi.spyOn(canvas, 'toDataURL').mockReturnValue(PIXELS)
    svgStandalone(svg, 512)
    expect(svg.querySelector('foreignObject canvas')).toBe(canvas)
    expect(svg.querySelector('image')).toBeNull()
  })

  it('pixel art: the image keeps sharp cells', () => {
    const { svg, canvas } = svg3d(true)
    vi.spyOn(canvas, 'toDataURL').mockReturnValue(PIXELS)
    const clone = svg.cloneNode(true) as SVGSVGElement
    freezeCanvases(svg, clone)
    expect(clone.querySelector('image')!.getAttribute('style')).toContain('pixelated')
  })

  it('an unreadable or empty canvas removes the foreignObject rather than tainting the export', () => {
    const { svg, canvas } = svg3d()
    vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const markup = svgStandalone(svg, 256)
    expect(markup).not.toContain('foreignObject')
    expect(markup).not.toContain('<image')
  })

  it('an SVG without 3D comes out unchanged (no image added)', () => {
    const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
    svg.appendChild(document.createElementNS(NS, 'circle'))
    const markup = svgStandalone(svg, 256)
    expect(markup).toContain('<circle')
    expect(markup).not.toContain('<image')
  })
})
