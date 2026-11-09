import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { heroChoisi } from './heros'

describe('directions de hero a l essai', () => {
  it('sans navigateur ou sans parametre, le hero actuel reste celui par defaut', () => {
    expect(heroChoisi()).toBeNull()
  })

  it('Site.vue ne prend une direction que si le parametre ?hero est a, b ou c', () => {
    const s = readFileSync(new URL('./Site.vue', import.meta.url), 'utf8')
    expect(s).toContain('const hero = id ? heros[id] : Hero')
    expect(s).toContain('<component :is="hero" />')
  })
})
