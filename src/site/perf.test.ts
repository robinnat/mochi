import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const lire = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
const scene = lire('../ui/trois/scene3d.ts')
const acc = lire('../ui/trois/accessoires3d.ts')

/** Garde-fous de la v12 (06/11/2026) : ce qui rendait la 3D lente sur iPhone ne doit pas revenir. */
describe('performance de la 3D (v12)', () => {
  it('le canvas WebGL partage ne fait que grandir : chaque avatar se rend dans un viewport, sans setSize a chaque image', () => {
    expect(scene).toContain('renderer.setViewport(0, 0, pxRendu, pxRendu)')
    expect(scene).toContain('renderer.setScissorTest(true)')
    expect(scene).not.toMatch(/if \(taille !== pxRendu\) renderer\.setSize/)
    expect(scene).toMatch(/toileGl\.width < pxRendu/)
  })

  it('les accessoires ne sont pas reconstruits a chaque respiration : leur cle ne contient pas le contour du corps', () => {
    expect(scene).toContain('const cleCorps = `${this.rendu}|${this.forme}`')
    expect(scene).toContain('this.suivreCorps(bb)')
    expect(acc).toContain('pieces(): Object3D[]')
    expect(acc).toContain('this.version++')
  })

  it('le Pixel relit ses pixels sur une toile logicielle (willReadFrequently), pas sur la toile visible', () => {
    expect(scene).toContain("getContext('2d', { willReadFrequently: true })")
    expect(scene).toContain('cp.getImageData(0, 0, px, px)')
    expect(scene).not.toContain('c.getImageData(0, 0, px, px)')
  })

  it('les shaders des trois styles sont compiles a l avance, apres la premiere image', () => {
    expect(scene).toContain('export function prechauffer()')
    expect(lire('./pret.ts')).toContain('m.prechauffer()')
    expect(lire('./Vivant.vue')).toContain('prechaufferStyles()')
  })

  it('un Mochi vivant se tourne au doigt, et le defilement vertical reste a la page', () => {
    const v = lire('./Vivant.vue')
    expect(v).toContain(':yaw="yaw + spin"')
    expect(v).toContain('setPointerCapture')
    expect(v).toContain('@pointerdown="onDown"')
    expect(lire('./site.css')).toMatch(/\.vivant\.tournable \{\s*touch-action: pan-y;/)
  })

  it('personnalisation : le bouton change tout de suite, le Mochi recoit le changement a l image suivante', () => {
    const p = lire('./PersoCorps.vue')
    expect(p).toContain('const bot = shallowRef(etatBot())')
    expect(p).toContain(':rendu="bot.rendu"')
    expect(p).toContain(':shape="bot.forme"')
  })
})
