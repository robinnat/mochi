// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from '@/ui/dom/reactive'
import { MochiBotElement, PROPERTIES, attributeOf, readAttribute } from './mochi-bot'

/**
 * Le Web Component natif `<mochi-bot>` : options en attributs et en proprietes, `<svg>` hote dans le DOM ordinaire,
 * evenements, methodes et nettoyage. happy-dom n'a pas de WebGL : comme un navigateur sans 3D, le Mochi y est
 * remplace par un court message (il n'y a plus de dessin 2D).
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
  it('la balise est declaree a l import, et chaque option est une propriete', () => {
    expect(customElements.get('mochi-bot')).toBe(MochiBotElement)
    const el = create()
    for (const p of PROPERTIES) expect(p.name in el, p.name).toBe(true)
  })

  it('observe un attribut kebab-case par option (sauf les fonctions)', () => {
    const obs = MochiBotElement.observedAttributes
    expect(obs).toContain('frozen-at')
    expect(obs).toContain('max-pixel-ratio')
    expect(obs).toContain('outline-width')
    expect(obs).not.toContain('gesture')
    expect(obs).not.toContain('gaze')
    expect(attributeOf('maxPixelRatio')).toBe('max-pixel-ratio')
  })

  it('lit les attributs selon le type : nombre, booleen, JSON, texte', () => {
    expect(readAttribute('number', '1.5')).toBe(1.5)
    expect(readAttribute('number', 'abc')).toBeUndefined()
    expect(readAttribute('boolean', '')).toBe(true)
    expect(readAttribute('boolean', 'false')).toBe(false)
    expect(readAttribute('json', '{"tete":"casquette"}')).toEqual({ head: 'cap' })
    expect(readAttribute('json', '{oups')).toBeUndefined()
    expect(readAttribute('text', 'star')).toBe('star')
    expect(readAttribute('text', null)).toBeUndefined()
  })
})

describe('<mochi-bot> : dessin', () => {
  it('dessine un SVG dans le DOM ordinaire, a la taille demandee, avec son texte alternatif', () => {
    const el = create({ size: '96', 'frozen-at': '1', label: 'Mon Mochi' })
    host().appendChild(el)
    const svg = el.querySelector('svg')!
    expect(svg).toBe(el.svg)
    expect(el.shadowRoot).toBeNull()
    expect(svg.getAttribute('width')).toBe('96')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Mon Mochi')
  })

  it('une option changee (attribut ou propriete) redessine a la tache suivante', async () => {
    const el = create({ shape: 'circle', 'frozen-at': '1' })
    host().appendChild(el)
    el.setAttribute('shape', 'star')
    await nextTick()
    expect(el.shape).toBe('star')
    el.size = 50
    await nextTick()
    expect(el.svg!.getAttribute('width')).toBe('50')
  })

  it("sans WebGL : un message et l'evenement sans3d, aucun dessin 2D de secours", async () => {
    const el = create({ 'frozen-at': '1' })
    const no3d = new Promise<void>((ok) => el.addEventListener('no3d', () => ok()))
    host().appendChild(el)
    await no3d
    await nextTick()
    expect(el.svg!.querySelector('[data-sans3d]')).not.toBeNull()
    expect(el.svg!.querySelector('mask, radialGradient, filter, [data-pixels]')).toBeNull()
  })

  it('retirer un attribut remet la value par defaut', async () => {
    const el = create({ size: '80', 'frozen-at': '1' })
    host().appendChild(el)
    el.removeAttribute('size')
    await nextTick()
    expect(el.size).toBe(320)
    expect(el.svg!.getAttribute('width')).toBe('320')
  })

  it('accepte des objets en propriete et en JSON (accessoires, cycle)', () => {
    const el = create({ accessories: '{"tete":"casquette"}' })
    expect(el.accessories).toEqual({ head: 'cap' })
    el.accessories = { eyes: 'round' }
    expect(el.accessories).toEqual({ eyes: 'round' })
    el.cycle = [{ state: 'wink', duration: 2 }]
    expect(el.cycle).toEqual([{ state: 'wink', duration: 2 }])
  })

  it('la meme image a la meme date figee : le dessin est reproductible', async () => {
    const a = create({ shape: 'cloud', 'frozen-at': '1.2' })
    const b = create({ shape: 'cloud', 'frozen-at': '1.2' })
    const h = host()
    h.append(a, b)
    await nextTick()
    expect(a.svg!.outerHTML).toBe(b.svg!.outerHTML)
  })
})

describe('<mochi-bot> : lecteur, evenements et methodes', () => {
  it('seek deplace la tete de lecture et previent par blockchange et statechange', () => {
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

  it('setMood, react, relacher et regarder sont des methodes de l element', () => {
    const el = create({ 'frozen-at': '1' })
    host().appendChild(el)
    expect(() => el.setMood('done')).not.toThrow()
    expect(el.react('laugh')).toBe(true)
    expect(el.react('unknown')).toBe(false)
    expect(() => el.release()).not.toThrow()
    expect(() => el.lookAt({ nx: 1, ny: -1 })).not.toThrow()
  })

  it('les methodes ne font rien (sans erreur) tant que l element n est pas dans la page', () => {
    const el = create()
    expect(() => el.seek(0)).not.toThrow()
    expect(el.react('laugh')).toBe(false)
  })
})

describe('<mochi-bot> : cycle de vie', () => {
  it('retire de la page, il arrete sa boucle et vide son dessin', async () => {
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

  it('deplace dans la page (meme tache), il garde son dessin et son etat', async () => {
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

  it('remis dans la page apres un retrait, il se redessine', async () => {
    const el = create({ 'frozen-at': '1' })
    const h = host()
    h.appendChild(el)
    el.remove()
    await Promise.resolve()
    await Promise.resolve()
    h.appendChild(el)
    expect(el.querySelector('svg')).not.toBeNull()
  })

  it('n ecrit jamais la langue ni le titre de la page hote', async () => {
    document.documentElement.lang = 'en'
    document.title = 'Page hote'
    host().appendChild(create({ 'frozen-at': '1' }))
    await nextTick()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Page hote')
  })
})
