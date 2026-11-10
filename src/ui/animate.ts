/**
 * Encodage du GIF anime exporte, image par image depuis la scene 3D.
 *
 * Tout est pur (des pixels vers des octets), donc testable en `node`. La capture des
 * images, elle, a besoin du DOM et du canvas 3D : elle vit dans `capture.ts`.
 *
 * Il n'y a plus de SVG anime : il animait les yeux du dessin 2D en CSS, et la 3D n'a
 * pas de dessin vectoriel a animer.
 */

/** Ecrit un entier non signe sur `n` octets, petit-boutiste. */
function le(value: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push((value / 2 ** (8 * i)) & 0xff)
  return out
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

/* ------------------------------------------------------------------- gif */

/**
 * Compression LZW du GIF : codes de longueur VARIABLE, ecrits bit a bit en
 * commencant par le bit de poids faible, et regroupes en sous-blocs de 255 octets
 * au plus.
 */
function lzw(indices: Uint8Array, bitsByPixel: number): number[] {
  const clear = 1 << bitsByPixel
  const end = clear + 1
  let size = bitsByPixel + 1
  let next = end + 1
  let dict = new Map<string, number>()

  const bytes: number[] = []
  let reserve = 0
  let bits = 0
  const write = (code: number) => {
    reserve |= code << bits
    bits += size
    while (bits >= 8) {
      bytes.push(reserve & 0xff)
      reserve >>= 8
      bits -= 8
    }
  }

  write(clear)
  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i]!
    const key = `${prefix},${c}`
    const known = dict.get(key)
    if (known !== undefined) {
      prefix = String(known)
      continue
    }
    write(Number(prefix))
    if (next < 4096) {
      dict.set(key, next++)
      // La largeur du code grandit un cran APRES que le dictionnaire ait
      // depasse ce qu'elle adresse, et ce decalage est le piege du format :
      // l'encodeur inscrit son entree juste apres avoir emis un code, alors que
      // le decodeur n'inscrit la sienne qu'en lisant le code SUIVANT. Il est donc
      // toujours en retard d'une entree, et l'encodeur doit elargir en retard
      // aussi. Ecrire `=== (1 << size)` desynchronise les deux et le flux
      // devient illisible — verifie par un test d'aller-retour.
      if (next > 1 << size && size < 12) size++
    } else {
      // Dictionnaire plein : on le repart a zero, le decodeur fait pareil en
      // voyant le code de remise a zero.
      write(clear)
      dict = new Map()
      size = bitsByPixel + 1
      next = end + 1
    }
    prefix = String(c)
  }
  write(Number(prefix))
  write(end)
  if (bits > 0) bytes.push(reserve & 0xff)

  // Decoupage en sous-blocs : chacun est precede de sa longueur, et un octet nul
  // termine la serie.
  const exit: number[] = [bitsByPixel]
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255)
    exit.push(block.length, ...block)
  }
  exit.push(0)
  return exit
}

/**
 * Palette commune a toutes les images, index 0 reserve au transparent.
 *
 * Elle se construit en DEUX temps — recenser les couleurs, puis indexer les
 * images — parce qu'un GIF exige une palette commune : il faut avoir vu toutes
 * les images avant d'en encoder une seule. Sur un cycle de trente secondes, les
 * garder en pixels bruts couterait 255 Mo ; recensees puis indexees, elles ne
 * pesent plus qu'un octet par pixel.
 */
export interface PaletteGif {
  /** Combien de pixels par teinte, pendant le recensement. */
  counts: Map<number, number>
  /** RGB compacte sur 24 bits -> index, une fois la palette arretee. */
  index: Map<number, number>
  /** Resolution des teintes absentes vers la plus proche retenue. */
  near: Map<number, number>
  /** Au moins un pixel transparent a ete vu. */
  transparence: boolean
}

export const newPalette = (): PaletteGif => ({
  counts: new Map(),
  index: new Map(),
  near: new Map(),
  transparence: false
})

/**
 * Recense les couleurs d'une image, en COMPTANT les pixels.
 *
 * Le comptage n'est pas un detail : une palette remplie au premier arrive se
 * serait gorgee des nuances d'anticrenelage des premieres images, et les teintes
 * des anneaux — qui n'apparaissent qu'au milieu du cycle — seraient toutes tombees
 * sur la meme case. Mesure : un cycle depasse les 255 couleurs, donc il FAUT
 * choisir lesquelles garder.
 */
export function listed(palette: PaletteGif, px: Uint8ClampedArray) {
  for (let p = 0; p < px.length; p += 4) {
    if (px[p + 3]! < 128) {
      palette.transparence = true
      continue
    }
    const key = (px[p]! << 16) | (px[p + 1]! << 8) | px[p + 2]!
    palette.counts.set(key, (palette.counts.get(key) ?? 0) + 1)
  }
}

/** Arrete la palette sur les 255 teintes les plus presentes. */
function stops(palette: PaletteGif) {
  if (palette.index.size) return
  const sorted = [...palette.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255)
  for (const [key] of sorted) palette.index.set(key, palette.index.size + 1)
}

/** Index de la teinte la plus proche parmi celles retenues, mis en cache. */
function nearest(palette: PaletteGif, key: number) {
  const known = palette.near.get(key)
  if (known !== undefined) return known
  const r = (key >> 16) & 0xff
  const v = (key >> 8) & 0xff
  const b = key & 0xff
  let best = 1
  let gap = Infinity
  for (const [other, i] of palette.index) {
    const dr = r - ((other >> 16) & 0xff)
    const dv = v - ((other >> 8) & 0xff)
    const db = b - (other & 0xff)
    const d = dr * dr + dv * dv + db * db
    if (d < gap) {
      gap = d
      best = i
    }
  }
  // Le cache borne le cout : chaque teinte absente n'est resolue qu'une fois,
  // meme si elle revient sur des centaines d'images.
  palette.near.set(key, best)
  return best
}

/** Traduit une image en index de palette, un octet par pixel. */
export function indexed(palette: PaletteGif, px: Uint8ClampedArray): Uint8Array {
  stops(palette)
  const out = new Uint8Array(px.length / 4)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    // 0 = transparent, et c'est deja la valeur par defaut du tableau
    if (px[p + 3]! < 128) continue
    const key = (px[p]! << 16) | (px[p + 1]! << 8) | px[p + 2]!
    out[i] = palette.index.get(key) ?? nearest(palette, key)
  }
  return out
}

/**
 * Assemble des images en GIF anime.
 *
 * La transparence du GIF est sur UN bit : un pixel est opaque ou invisible, rien
 * entre les deux. Sur un fond transparent, le bord antialiase de la boule est donc
 * tranche a 50 % d'opacite et ressort en marches d'escalier. Ce n'est pas un defaut
 * a corriger, c'est le format — d'ou le choix laisse a l'utilisateur entre ce bord
 * dur et un fond plein, ou le bord reste lisse parce qu'il a de quoi se fondre.
 *
 * La transparence est DEDUITE des images, pas demandee : des images deja aplaties
 * sur un fond n'ont pas a declarer d'index transparent, et surtout pas a etre
 * eliminees « retour au fond » entre deux — ce qui ferait clignoter le fond.
 *
 * Le GIF sert aux avatars animes (Discord, Slack) ; le montage entier sort aussi en MP4.
 */
export function gifAnimate(
  images: Uint8ClampedArray[],
  width: number,
  height: number,
  delayMs: number
): Uint8Array<ArrayBuffer> {
  if (!images.length) throw new Error('aucune image a emballer')
  const palette = newPalette()
  for (const px of images) listed(palette, px)
  return gifIndexed(
    palette,
    images.map((px) => indexed(palette, px)),
    width,
    height,
    delayMs
  )
}

/**
 * Meme chose, mais sur des images DEJA indexees — la voie a memoire bornee, pour
 * les longues sequences. Cf. `PaletteGif`.
 */
export function gifIndexed(
  palette: PaletteGif,
  images: Uint8Array[],
  width: number,
  height: number,
  delayMs: number
): Uint8Array<ArrayBuffer> {
  if (!images.length) throw new Error('aucune image a emballer')

  stops(palette)
  const transparence = palette.transparence
  const colors = palette.index
  // Une palette GIF a une taille en puissance de deux, et il faut au moins deux
  // bits par pixel pour que le code de remise a zero tienne.
  const bits = Math.max(2, Math.ceil(Math.log2(colors.size + 1)))
  const sizeTable = 1 << bits

  const table: number[] = [0, 0, 0] // index 0 : le transparent, couleur sans importance
  for (const key of colors.keys()) table.push((key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff)
  while (table.length < sizeTable * 3) table.push(0)

  const out: number[] = [
    ...ascii('GIF89a'),
    ...le(width, 2),
    ...le(height, 2),
    0x80 | (bits - 1), // table globale presente, et sa taille
    0, // index de fond : le transparent
    0, // pas de rapport d'aspect
    ...table,
    // Boucle sans fin, par l'extension Netscape — rien d'autre ne sait le dire.
    0x21,
    0xff,
    0x0b,
    ...ascii('NETSCAPE2.0'),
    0x03,
    0x01,
    ...le(0, 2),
    0x00
  ]

  // Le delai du GIF se compte en CENTIEMES de seconde : c'est ce qui limite sa
  // cadence, un delai de 0 ou 1 etant traite differemment selon les lecteurs.
  const delay = Math.max(2, Math.round(delayMs / 10))

  for (const indices of images) {
    out.push(
      0x21,
      0xf9,
      0x04,
      // Sur fond transparent : elimination « retour au fond » (2) et index
      // transparent declare, sinon les zones vides laissent voir l'image
      // precedente et la boule traine derriere elle.
      //
      // Sur fond plein : « laisser en place » (1), et surtout PAS de retour au
      // fond — chaque image couvre toute la toile, donc effacer entre deux ne
      // sert qu'a faire clignoter le fond.
      transparence ? (2 << 2) | 0x01 : 1 << 2,
      ...le(delay, 2),
      0, // index transparent
      0x00,
      0x2c,
      ...le(0, 2),
      ...le(0, 2),
      ...le(width, 2),
      ...le(height, 2),
      0, // pas de table locale, pas d'entrelacement
      ...lzw(indices, bits)
    )
  }

  out.push(0x3b)
  return new Uint8Array(out)
}
