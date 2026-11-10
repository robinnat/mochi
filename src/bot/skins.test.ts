import { describe, expect, it } from 'vitest'
import { BotEngine, type RenderedEye } from './engine'
import { eyeOffset, FOR_TESTS } from './eyefit'
import { EXPRESSIONS } from './expressions'
import { DEFAULT_SHAPE, SHAPES, SHAPE_BY_ID, colorOf, isValidHex } from './skins'
import { STATES, type StateId } from './states'

/**
 * Les formes du personnalisateur, mesurees contre le corps qu'elles remplacent.
 *
 * Ce fichier verrouille deux choses, et la seconde a coute bien plus que la premiere :
 *
 * 1. **La gelule ne sort pas de la silhouette.** Les yeux vivent sur une sphere, et
 *    `radiusAtAngle` les recolle au contour au prorata du rayon local — ce qui divise leur
 *    marge par le meme prorata. Une forme etroite dans la direction de l'oeil le poussait
 *    contre le bord jusqu'a ce que le masque l'ouvre : la gelule apparaissait comme une
 *    encoche dans le corps.
 * 2. **La correction ne se voit pas bouger.** Sept versions l'ont calculee dans la boucle
 *    de rendu et toutes tremblaient. Les tests d'oscillation ci-dessous sont ce qui les a
 *    disqualifiees, et ils comparent au CERCLE, la forme que la correction ne touche pas.
 *
 * Tout porte sur la GEOMETRIE RENDUE et non sur le calcul : on reprend le contour du corps
 * et celui de chaque gelule tels que le composant les dessine. C'est la seule facon de
 * verifier ce que l'oeil voit, et ca ne suppose rien de la methode employee.
 */

const R = 100

/**
 * Contour du corps, lu sur le `bodyPath`. `closedPath` emet `M x y` puis un `C` par point,
 * donc les points de la courbe sont la 3e paire de chaque `C`.
 */
function bodyOutline(d: string) {
  const pts: Array<{ x: number; y: number }> = []
  for (const seg of d.slice(1).split('C')) {
    const n = seg.match(/-?\d+\.?\d*/g)?.map(Number) ?? []
    if (n.length >= 6) pts.push({ x: n[4]!, y: n[5]! })
    else if (n.length === 2) pts.push({ x: n[0]!, y: n[1]! })
  }
  return pts
}

/** Le point est-il dans le polygone ? Lancer de rayon. */
function dedans(poly: Array<{ x: number; y: number }>, x: number, y: number) {
  let on = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) on = !on
  }
  return on
}

/**
 * Contour d'une gelule en coordonnees ecran : un stade, echantillonne puis passe par la
 * matrice rendue. Les dimensions sont relues dans le `d` que `capsulePath` a produit
 * (`M-hw -hh+r A r r ...`), pour ne dependre que de la sortie.
 *
 * Trente-deux points suffisent : sur une gelule de 40 unites de long ils sont espaces de
 * moins de trois unites, la ou le plus petit debordement qu'on ait mesure en vaut trois.
 */
function eyeOutline(eye: RenderedEye, N = 32) {
  const g = eye.d.match(/-?\d+\.?\d*/g)!.map(Number)
  const hw = Math.abs(g[0]!)
  const r = Math.abs(g[2]!)
  const droit = Math.abs(g[1]!)
  const m = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
  const [a, b, c, d, e, f] = m as [number, number, number, number, number, number]
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < N; i++) {
    const u = (i / N) * 4
    let x: number
    let y: number
    if (u < 1) {
      const t = Math.PI * (u - 0.5)
      x = Math.cos(t) * r
      y = -droit + Math.sin(t) * r
    } else if (u < 2) {
      x = hw
      y = -droit + (u - 1) * 2 * droit
    } else if (u < 3) {
      const t = Math.PI * (u - 2 + 0.5)
      x = Math.cos(t) * r
      y = droit + Math.sin(t) * r
    } else {
      x = -hw
      y = droit - (u - 3) * 2 * droit
    }
    out.push({ x: a * x + c * y + e, y: b * x + d * y + f })
  }
  return out
}

/** Trois secondes a vingt images par seconde : assez pour plusieurs clignements. */
const INSTANTS = 60
const STEP = 1 / 20

/**
 * De combien la gelule la plus debordante sort du corps, en unites de viewBox.
 *
 * Balaye le TEMPS et pas seulement la combinaison. La derive du regard deplace l'oeil
 * d'une douzaine d'unites, donc une seule image ne prouve rien : c'est en ne mesurant qu'a
 * `POSES[state]` que `capsule` + `scared` est passe inapercu, alors qu'il sortait de
 * 4,4 unites une seconde plus tard.
 */
function overflow(state: StateId, radii: number[], expr: (typeof EXPRESSIONS)[number] | null) {
  const e = new BotEngine(R, state, radii, expr)
  let worst = 0
  for (let i = 0; i < INSTANTS; i++) {
    const f = e.sample(i * STEP)
    const body = bodyOutline(f.bodyPath)
    for (const eye of f.eyes) {
      for (const p of eyeOutline(eye)) {
        if (dedans(body, p.x, p.y)) continue
        worst = Math.max(worst, Math.min(...body.map((q) => Math.hypot(q.x - p.x, q.y - p.y))))
      }
    }
  }
  return worst
}

/** Les etats dont le corps est remplacable par une forme du personnalisateur. */
const BODY_OF_BASE = STATES.filter((s) => s.baseBody).map((s) => s.id)
/** Les autres : leur silhouette EST l'animation, relevee sur la video. */
const SILHOUETTE_MEASURED = STATES.filter((s) => !s.baseBody).map((s) => s.id)

describe('shapes du personnalisateur', () => {
  // 680 combinaisons x 60 instants x deux contours : le test le plus lourd du depot, et le
  // seul qui prouve ce que l'oeil voit.
  it("aucune shape ne laisse un oeil sortir de la silhouette", () => {
    const faulty: string[] = []
    for (const state of BODY_OF_BASE) {
      for (const shape of SHAPES) {
        for (const expr of [null, ...EXPRESSIONS]) {
          const exit = overflow(state, shape.radii, expr)
          if (exit > 0.05) {
            faulty.push(`${state}/${shape.id}/${expr?.id ?? 'pose'} ${exit.toFixed(1)}`)
          }
        }
      }
    }
    // Cinq couples etat x forme debordaient : `wide`+`capsule` de 14,5 unites sur une boule
    // de rayon 100, `wide`+`triangle` de 11,9, `idle`+`capsule` et `swirl`+`capsule` de 5,3,
    // `notify`+`drop` de 3,3.
    expect(faulty).toEqual([])
  }, 30_000)

  /**
   * Le cercle est la forme relevee sur la video, et le corps par defaut : le choisir dans
   * le personnalisateur ne doit RIEN changer par rapport a ne rien choisir. C'est ce qui
   * garantit que la correction est neutre sur la reference — y compris son oeil exterieur,
   * qui frole deja le bord et doit continuer de le froler. C'est aussi ce qui protege
   * `public/favicon.svg`, dont les deux matrices d'yeux sont celles de `sample(1)` sur
   * `idle`, au byte.
   */
  it('choisir le cercle rend exactement la meme chose que ne rien choisir', () => {
    expect(DEFAULT_SHAPE).toBe('circle')
    const circle = SHAPE_BY_ID.get('circle')!.radii
    for (const state of BODY_OF_BASE) {
      for (const expr of [null, ...EXPRESSIONS]) {
        const withIt = new BotEngine(R, state, circle, expr).sample(1)
        const without = new BotEngine(R, state, null, expr).sample(1)
        expect(withIt.eyes, `${state}/${expr?.id ?? 'pose'}`).toEqual(without.eyes)
      }
      expect(eyeOffset(circle, state, null)).toEqual({ x: 0, y: 0 })
    }
  })

  /**
   * Les silhouettes relevees sur la video ne sont pas remplacables, donc la forme choisie
   * ne doit pas les atteindre — ni leur corps, ni leurs yeux. `orbit` est le cas qui
   * compte : la marge de son oeil est plus serree que celle du cercle et elle est pourtant
   * juste, puisque relevee ainsi. Une regle de marge appliquee sans distinction la
   * deplacerait.
   */
  it("la shape choisie ne touche pas aux etats a silhouette mesuree", () => {
    for (const state of SILHOUETTE_MEASURED) {
      const bare = new BotEngine(R, state, null, null).sample(1)
      for (const shape of SHAPES) {
        const dressed = new BotEngine(R, state, shape.radii, null).sample(1)
        expect(dressed.eyes, `${state}/${shape.id}`).toEqual(bare.eyes)
        expect(dressed.bodyPath).toBe(bare.bodyPath)
      }
    }
  })

  /**
   * La correction ne doit RIEN modifier a la taille des yeux.
   *
   * Une version la mettait a l'echelle en meme temps que la position : ca conservait tous
   * les rapports du visage et restait stable, mais les yeux devenaient visiblement plus
   * petits sur un corps plat, et changer d'expression animait alors ce grossissement. Ca se
   * lisait comme un defaut.
   */
  it('la taille des yeux ne depend pas de la shape', () => {
    const sizes = new Set(
      SHAPES.map((f) =>
        new BotEngine(R, 'idle', f.radii, null)
          .sample(1)
          .eyes.map((y) => y.d)
          .join('|')
      )
    )
    expect(sizes.size).toBe(1)
  })

  /**
   * Le vrai piege : la correction doit etre INVISIBLE en mouvement.
   *
   * Ce qu'on mesure est l'OSCILLATION et non la vitesse. Un morph deplace les yeux vite de
   * toute facon — les expressions ne regardent pas au meme endroit — et c'est du mouvement
   * voulu. Trembler, c'est aller et REVENIR. On compte donc les changements de sens image
   * par image, et on les compare au cercle, que la correction ne touche pas.
   *
   * La mesure discrimine tres bien : 0 a 1 aller-retour sur le moteur d'origine, 4 a 14
   * avec des reculs jusqu'a 26 unites sur les versions qui tremblaient.
   */
  it('la correction ne fait pas osciller les yeux', () => {
    const step = 1 / 60

    const path = (bâti: () => BotEngine, duration = BotEngine.SHAPE_MORPH) => {
      const e = bâti()
      const out: Array<Array<{ x: number; y: number }>> = []
      for (let t = 0; t <= duration + step; t += step) {
        out.push(
          e.sample(t).eyes.map((eye) => {
            const n = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
            return { x: n[4]!, y: n[5]! }
          })
        )
      }
      return out
    }

    /** Combien de fois un oeil repart en arriere, et de combien au plus. */
    const roundReturns = (suite: Array<Array<{ x: number; y: number }>>) => {
      let n = 0
      let amplitude = 0
      const eyes = Math.min(...suite.map((f) => f.length))
      for (let j = 0; j < eyes; j++) {
        let px = 0
        let py = 0
        for (let i = 1; i < suite.length; i++) {
          const dx = suite[i]![j]!.x - suite[i - 1]![j]!.x
          const dy = suite[i]![j]!.y - suite[i - 1]![j]!.y
          const len = Math.hypot(dx, dy)
          if (len <= 0.05) continue
          if ((px || py) && dx * px + dy * py < 0) {
            n++
            amplitude = Math.max(amplitude, len)
          }
          px = dx
          py = dy
        }
      }
      return { n, amplitude }
    }

    const circle = SHAPE_BY_ID.get('circle')!.radii
    const morphOfShape = (radii: number[]) =>
      roundReturns(
        path(() => {
          const e = new BotEngine(R, 'idle', circle, null)
          e.setShape(radii, 0)
          return e
        })
      )
    const atIdle = (radii: number[]) =>
      roundReturns(path(() => new BotEngine(R, 'idle', radii, null), 3))
    const morphsDExpression = (radii: number[]) =>
      EXPRESSIONS.map((expr) =>
        roundReturns(
          path(() => {
            const e = new BotEngine(R, 'idle', radii, EXPRESSIONS[0]!)
            e.setExpression(expr, 0)
            return e
          })
        )
      ).reduce((a, b) => ({ n: a.n + b.n, amplitude: Math.max(a.amplitude, b.amplitude) }), {
        n: 0,
        amplitude: 0
      })

    /*
     * Sur le CERCLE, rien du tout : la correction y est nulle, donc elle ne peut ajouter
     * aucun mouvement, et c'est la reference des trois comparaisons.
     */
    expect(morphsDExpression(circle).n, 'cercle : morphs d expression').toBe(0)

    for (const shape of SHAPES) {
      // Au repos, la seule chose qui bouge est la derive du regard. Une correction qui la
      // suivrait ferait trembler les yeux en permanence : c'est le defaut le plus visible
      // de tous, et le premier qu'on a eu.
      expect(atIdle(shape.radii).n, `${shape.id} : derive au idle`).toBeLessThanOrEqual(
        atIdle(circle).n + 1
      )
      // Un changement de forme fait bouger le decalage, mais sur la meme courbe que la
      // silhouette : aucun aller-retour de plus que le cercle.
      expect(morphOfShape(shape.radii).n, `morph de shape to ${shape.id}`).toBeLessThanOrEqual(
        morphOfShape(circle).n + 1
      )
      /*
       * Un changement d'expression fait passer le decalage d'une entree de table a l'autre.
       * Sept formes sur huit n'y gagnent aucun aller-retour ; la `drop` passe de un
       * rebroussement de 6,3 unites — deja present sans correction — a deux de 11,1. La
       * borne laisse passer ca et rien de plus : les versions fautives etaient a 26.
       */
      expect(
        morphsDExpression(shape.radii).amplitude,
        `${shape.id} : morphs d expression`
      ).toBeLessThan(14)
    }
  })

  /**
   * La table est une constante de module. Elle doit rester assez rapide a batir pour ne pas
   * peser sur le premier affichage : c'est le seul cout que ce correctif ajoute au moteur,
   * qui ne fait plus ensuite qu'y lire deux entrees et les interpoler.
   */
  it('la table se batit en quelques millisecondes', () => {
    const t = performance.now()
    FOR_TESTS.batir()
    expect(performance.now() - t).toBeLessThan(200)
  })
})

describe('couleur libre (hex) du corps', () => {
  it('hexValide accepte #rgb et #rrggbb, avec ou sans diese, et normalise en minuscules', () => {
    expect(isValidHex('#FF8800')).toBe('#ff8800')
    expect(isValidHex('f80')).toBe('#ff8800')
    expect(isValidHex(' #AbC ')).toBe('#aabbcc')
    for (const bad of ['', '#12', '#12345', '#1234567', 'red', '#ggg', null, undefined]) expect(isValidHex(bad as string)).toBeNull()
  })
  it('couleurDe : un id du catalogue, sinon un hex libre, sinon l encre', () => {
    expect(colorOf('violet')).toBe('#8b3dff')
    expect(colorOf('#ff8800')).toBe('#ff8800')
    expect(colorOf('#f80')).toBe('#ff8800')
    expect(colorOf('nimporte')).toBe('#0a0a0c')
  })
})
