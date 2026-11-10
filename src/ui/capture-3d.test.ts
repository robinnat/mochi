// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { figeToiles, svgAutonome } from './capture'

/**
 * Export d'une image fixe en vraie 3D (le style par defaut).
 *
 * La 3D dessine le corps dans un canvas WebGL pose dans un `<foreignObject>`. Serialise tel quel, ce noeud
 * souillait le canvas de rasterisation : `toBlob` echouait en `SecurityError` et l'export PNG affichait
 * « Export failed ». Et le fichier SVG, lui, livrait un canvas vide (`cloneNode` ne copie pas les pixels).
 * happy-dom ne rasterise rien : on verrouille donc ce qui rend la rasterisation sure, le SVG lui-meme.
 */

const NS = 'http://www.w3.org/2000/svg'
const PIXELS = 'data:image/png;base64,iVBORw0KGgo='

function svg3d(pixel = false) {
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
  svg.setAttribute('viewBox', '-158 -158 316 316')
  svg.setAttribute('class', 'h-full w-full')
  const anneau = document.createElementNS(NS, 'path')
  anneau.setAttribute('d', 'M0 0L1 1')
  svg.appendChild(anneau)
  const fo = document.createElementNS(NS, 'foreignObject')
  for (const [k, v] of Object.entries({ x: '-158', y: '-158', width: '316', height: '316' })) fo.setAttribute(k, v)
  const toile = document.createElement('canvas')
  toile.width = 320
  toile.height = 320
  if (pixel) toile.style.imageRendering = 'pixelated'
  fo.appendChild(toile)
  svg.appendChild(fo)
  document.body.appendChild(svg)
  return { svg, toile }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('export fixe en vraie 3D', () => {
  it('le SVG exporte ne contient plus de foreignObject ni de canvas, mais une image data: du corps rendu', () => {
    const { svg, toile } = svg3d()
    const lu = vi.spyOn(toile, 'toDataURL').mockReturnValue(PIXELS)
    const markup = svgAutonome(svg, 1024)
    expect(lu).toHaveBeenCalledWith('image/png')
    expect(markup).not.toContain('foreignObject')
    expect(markup).not.toContain('<canvas')
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const img = doc.querySelector('image')!
    expect(img).not.toBeNull()
    expect(img.getAttribute('href')).toBe(PIXELS)
    // cale exactement la ou etait le canvas
    expect([img.getAttribute('x'), img.getAttribute('y'), img.getAttribute('width'), img.getAttribute('height')]).toEqual([
      '-158',
      '-158',
      '316',
      '316'
    ])
    // le reste du dessin (anneaux) est intact
    expect(doc.querySelector('path')).not.toBeNull()
  })

  it('le noeud affiche n est pas touche : seul le clone est fige', () => {
    const { svg, toile } = svg3d()
    vi.spyOn(toile, 'toDataURL').mockReturnValue(PIXELS)
    svgAutonome(svg, 512)
    expect(svg.querySelector('foreignObject canvas')).toBe(toile)
    expect(svg.querySelector('image')).toBeNull()
  })

  it('pixel art : l image garde des cases nettes', () => {
    const { svg, toile } = svg3d(true)
    vi.spyOn(toile, 'toDataURL').mockReturnValue(PIXELS)
    const clone = svg.cloneNode(true) as SVGSVGElement
    figeToiles(svg, clone)
    expect(clone.querySelector('image')!.getAttribute('style')).toContain('pixelated')
  })

  it('un canvas illisible ou vide retire le foreignObject plutot que de souiller l export', () => {
    const { svg, toile } = svg3d()
    vi.spyOn(toile, 'toDataURL').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const markup = svgAutonome(svg, 256)
    expect(markup).not.toContain('foreignObject')
    expect(markup).not.toContain('<image')
  })

  it('un SVG sans 3D sort inchange (aucune image ajoutee)', () => {
    const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
    svg.appendChild(document.createElementNS(NS, 'circle'))
    const markup = svgAutonome(svg, 256)
    expect(markup).toContain('<circle')
    expect(markup).not.toContain('<image')
  })
})
