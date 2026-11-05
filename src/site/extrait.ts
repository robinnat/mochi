import type { RenduId } from '@/ui/rendu'
import { PAR_ID, type Emplacement, type Selection } from '@/bot/emplacements'

export interface OptionsExtrait {
  forme: string
  couleur: string
  rendu: RenduId
  contour: boolean
  /** ombrage du volume du corps (Soft, Flat, Pixel) */
  ombrage: boolean
  reflet: boolean
  mood: string
  /** accessoires par emplacement, avec leurs couleurs */
  accessoires: Selection
  /** `auto` : rien a ecrire, Mochi suit la page */
  theme: 'auto' | 'light' | 'dark'
  /** ordinateur du mood `travaille` (defaut : oui) */
  ordinateur: boolean
  taille?: number
}

const EMPLACEMENTS: Emplacement[] = ['tete', 'yeux', 'visage', 'bas', 'dos']

/** `{ tete: 'casquette' }` quand les couleurs sont celles du catalogue, sinon `{ id, c1, c2 }` (seulement ce qui change). */
export function accessoiresEnCode(sel: Selection): string {
  const l: string[] = []
  for (const e of EMPLACEMENTS) {
    const c = sel[e]
    if (!c) continue
    const id = typeof c === 'string' ? c : c.id
    const def = PAR_ID.get(`${e}:${id}`)
    const o: { c1?: string; c2?: string } = typeof c === 'string' ? {} : c
    const champs: string[] = [`id: '${id}'`]
    if (o.c1 && o.c1 !== def?.c1) champs.push(`c1: '${o.c1}'`)
    if (o.c2 && o.c2 !== def?.c2) champs.push(`c2: '${o.c2}'`)
    l.push(champs.length === 1 ? `${e}: '${id}'` : `${e}: { ${champs.join(', ')} }`)
  }
  return l.length ? `{ ${l.join(', ')} }` : ''
}

/** L'extrait de code montre par la section « Make it yours » : un composant Vue, seulement ce qui differe des valeurs par defaut. */
export function extraitCode(o: OptionsExtrait): string {
  const l = [`    shape="${o.forme}"`, `    color="${o.couleur}"`]
  if (o.rendu !== '3d') l.push(`    rendu="${o.rendu}"`)
  if (o.rendu === 'flat3d' && o.contour) l.push('    contour')
  if (o.rendu === '3d' && !o.reflet) l.push('    :reflet="false"')
  if (!o.ombrage) l.push('    :ombrage="false"')
  l.push(`    mood="${o.mood}"`)
  if (o.mood === 'travaille' && !o.ordinateur) l.push('    :ordinateur="false"')
  const acc = accessoiresEnCode(o.accessoires)
  if (acc) l.push(`    :accessoires="${acc}"`)
  if (o.theme !== 'auto') l.push(`    theme="${o.theme}"`)
  l.push(`    :size="${o.taille ?? 260}"`)
  return `<script setup lang="ts">\nimport MochiBot from './components/MochiBot.vue'\n<\/script>\n\n<template>\n  <MochiBot\n${l.join('\n')}\n  />\n</template>`
}
