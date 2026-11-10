import { computed, ref, shallowRef, watch } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
import { Vivant } from './Vivant'
import { CodeBlock } from './CodeBlock'
import { useReduit } from './reduced'
import { reveal, useLargeur } from './motion'
import { ACCESSOIRES_SITE, COLOR_LABEL, EMPLACEMENT_LABEL, EMPLACEMENTS_IDS, FORMES_3D, HUMEURS_SITE, PALETTE_SITE } from './catalog'
import { cheminDeForme, couleurDe, hexValide, SHAPE_BY_ID, COULEURS_ACCESSOIRES as COULEURS, type Emplacement, type MoodId, type RenduId, type Selection } from 'mochi-world/catalogue'
import { STYLES_SITE } from './style'
import { extraitCode } from './extrait'
import { urlPiece } from './affiches'
import { themeEffectif } from './theme'

const NOMS_COULEURS: Record<string, string> = {
  rouge: 'Red', jaune: 'Yellow', turquoise: 'Teal', marine: 'Navy', rose: 'Pink', creme: 'Cream', noir: 'Black',
  or: 'Gold', vert: 'Green', orange: 'Orange', violet: 'Purple', bleu: 'Blue', paille: 'Straw'
}
/** Couleurs des accessoires : la palette du catalogue des accessoires (les pieces naissent dans ces teintes). */
const PALETTE_ACC = Object.entries(COULEURS).map(([id, hex]) => ({ id, hex, label: NOMS_COULEURS[id] ?? id }))

/** Icones des formes : la vraie silhouette du moteur, en SVG. */
const silhouette = (id: string) => {
  const radii = SHAPE_BY_ID.get(id)?.radii
  return radii ? cheminDeForme(radii) : ''
}
const FORMES = FORMES_3D.map((f) => ({ ...f, d: silhouette(f.id) }))

type ChoixPiece = { id: string; c1: string; c2: string }
const AUCUN: ChoixPiece = { id: '', c1: '', c2: '' }
const options = (e: Emplacement) => ACCESSOIRES_SITE(e)
const THEMES = ['auto', 'light', 'dark'] as const

export const PersoCorps: Composant<Record<string, never>> = () => {
  const reduit = useReduit()
  const largeur = useLargeur()
  const taille = computed(() => (largeur.value >= 900 ? 320 : 210))

  /* ------------------------------------------------------------------ choix */
  const forme = ref('etoile')
  /** une couleur libre en hex (`#ff8800`) ou un id du catalogue du moteur */
  const couleur = ref('#21b0ff')
  const texteHex = ref('#21b0ff')
  const hexCourant = computed(() => couleurDe(couleur.value))
  function poserCouleur(x: string) {
    couleur.value = x
    texteHex.value = couleurDe(x)
  }
  function saisirHex(v: string) {
    texteHex.value = v
    const hx = hexValide(v)
    if (hx) couleur.value = hx
  }
  const nomCouleur = computed(() => PALETTE_SITE.find((p) => p.hex === couleur.value)?.nom ?? COLOR_LABEL[couleur.value] ?? hexCourant.value.toUpperCase())
  const rendu = ref<RenduId>('3d')
  const mood = ref<MoodId>('repos')
  const ordinateur = ref(true)
  const theme = ref<'auto' | 'light' | 'dark'>('auto')
  /** Rejouer le salut a l'arrivee. */
  const arrivee = ref(0)

  /** Les pieces portees, une par emplacement ; remplacees en bloc a chaque changement (jamais mutees). */
  const choix = ref<Record<Emplacement, ChoixPiece>>({
    tete: { id: 'casquette', c1: COULEURS.rouge, c2: COULEURS.rouge },
    yeux: AUCUN,
    visage: AUCUN,
    bas: AUCUN,
    dos: AUCUN
  })
  const poser = (e: Emplacement, p: ChoixPiece) => (choix.value = { ...choix.value, [e]: p })
  const slot = ref<Emplacement>('tete')
  function choisir(e: Emplacement, id: string) {
    const a = options(e).find((o) => o.id === id)
    poser(e, a ? { id, c1: a.c1, c2: a.c2 } : AUCUN)
  }
  const aDeuxCouleurs = (e: Emplacement) => {
    const a = options(e).find((o) => o.id === choix.value[e].id)
    return !!a && a.c1 !== a.c2
  }
  function poserC1(e: Emplacement, hex: string) {
    const p = choix.value[e]
    poser(e, { ...p, c1: hex, c2: aDeuxCouleurs(e) ? p.c2 : hex })
  }
  const accessoires = computed<Selection>(() => {
    const s: Selection = {}
    for (const e of EMPLACEMENTS_IDS) if (choix.value[e].id) s[e] = { id: choix.value[e].id, c1: choix.value[e].c1, c2: choix.value[e].c2 }
    return s
  })
  const nbPortes = computed(() => EMPLACEMENTS_IDS.filter((e) => choix.value[e].id).length)
  /** Onglets : fleches gauche et droite, Debut et Fin (contrat clavier du role `tablist`), le focus suit. */
  function clavierOnglets(ev: KeyboardEvent) {
    const i = EMPLACEMENTS_IDS.indexOf(slot.value)
    const n = EMPLACEMENTS_IDS.length
    const j = ev.key === 'ArrowRight' ? (i + 1) % n : ev.key === 'ArrowLeft' ? (i - 1 + n) % n : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1
    if (j < 0) return
    ev.preventDefault()
    slot.value = EMPLACEMENTS_IDS[j]!
    const liste = (ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
    liste[j]?.focus()
  }
  function toutRetirer() {
    for (const e of EMPLACEMENTS_IDS) choisir(e, '')
  }

  /** Rejouer le salut remonte le Mochi ; forme, style, couleur et humeur changent sans le remonter. */
  const cle = computed(() => [arrivee.value, reduit.value].join('|'))

  const extrait = computed(() =>
    extraitCode({
      forme: forme.value,
      couleur: couleur.value,
      rendu: rendu.value,
      mood: mood.value,
      accessoires: accessoires.value,
      theme: theme.value,
      ordinateur: ordinateur.value
    })
  )

  /** Icones des accessoires : images pre-rendues (public/rendus). */
  const icone = (e: Emplacement, id: string) => urlPiece(e, id, themeEffectif.value)

  /**
   * Reponse immediate (v12) : un clic change d'abord le bouton (peint a l'image suivante), et le Mochi recoit le
   * changement juste APRES cette image. Plusieurs changements rapides se regroupent en un seul rendu.
   */
  const etatBot = () => ({
    forme: forme.value,
    couleur: couleur.value,
    rendu: rendu.value,
    mood: mood.value,
    ordinateur: ordinateur.value,
    theme: theme.value,
    accessoires: accessoires.value
  })
  const bot = shallowRef(etatBot())
  let enAttente = false
  /** L'affiche (image pre-rendue) ne vaut que pour le Mochi de depart : au premier changement, plus d'affiche. */
  const touche = ref(false)
  watch([forme, couleur, rendu, mood, ordinateur, theme, accessoires], () => {
    touche.value = true
    if (enAttente) return
    enAttente = true
    requestAnimationFrame(() =>
      setTimeout(() => {
        enAttente = false
        bot.value = etatBot()
      }, 0)
    )
  })

  const rv = [reveal(0), reveal(1), reveal(2), reveal(3), reveal(4), reveal()]
  const pastille = (cl: { id: string; hex: string; label: string }, presse: boolean, choisirC: () => void, suffixe = '') =>
    h('button', {
      key: cl.id,
      type: 'button',
      class: 'pastille petite',
      style: { background: cl.hex },
      'aria-label': cl.label + suffixe,
      'aria-pressed': presse,
      onClick: choisirC
    })

  return () => {
    const s = slot.value
    const ch = choix.value[s]
    const b = bot.value
    return h(
      'div',
      { class: 'perso-corps' },
      h(
        'div',
        { class: 'wrap perso-grille' },
        h(
          'div',
          { class: 'perso-gauche' },
          h(
            'div',
            { class: ['perso-scene', { sombre: theme.value === 'dark', clair: theme.value === 'light' }] },
            c(Vivant, {
              key: cle.value,
              taille: taille.value,
              eager: true,
              affiche: touche.value || arrivee.value > 0 || reduit.value ? null : 'perso',
              alt: 'Your Mochi',
              bot: {
                shape: b.forme,
                color: b.couleur,
                rendu: b.rendu,
                contour: false,
                mood: b.mood,
                ordinateur: b.ordinateur,
                accessoires: b.accessoires,
                theme: b.theme === 'auto' ? undefined : b.theme,
                coucou: arrivee.value > 0 && !reduit.value,
                frozenAt: reduit.value ? 0 : undefined
              }
            }),
            h(
              'div',
              { class: 'perso-outils' },
              h(
                'div',
                { class: 'segment petit', role: 'group', 'aria-label': 'Theme of this Mochi' },
                THEMES.map((x) =>
                  h(
                    'button',
                    { key: x, type: 'button', 'aria-pressed': theme.value === x, onClick: () => (theme.value = x) },
                    x === 'auto' ? 'Page' : x === 'light' ? 'Light' : 'Dark'
                  )
                )
              ),
              h('button', { type: 'button', class: 'btn petit', onClick: () => arrivee.value++ }, 'Replay hello')
            )
          )
        ),
        h(
          'div',
          { class: 'perso-panneau' },
          h(
            'div',
            { ref: rv[0], class: 'groupe' },
            h('h3', null, 'Style'),
            h(
              'div',
              { class: 'segment', role: 'group', 'aria-label': 'Render style' },
              STYLES_SITE.map((r) => h('button', { key: r.id, type: 'button', 'aria-pressed': rendu.value === r.id, onClick: () => (rendu.value = r.id) }, r.label))
            )
          ),
          h(
            'div',
            { ref: rv[1], class: 'groupe' },
            h('h3', null, 'Shape'),
            h(
              'div',
              { class: 'formes-choix', role: 'group', 'aria-label': 'Shape' },
              FORMES.map((f) =>
                h(
                  'button',
                  { key: f.id, type: 'button', class: 'forme-choix', 'aria-pressed': forme.value === f.id, title: f.label, onClick: () => (forme.value = f.id) },
                  h('svg', { viewBox: '-13 -13 26 26', width: '30', height: '30', 'aria-hidden': 'true' }, h('path', { d: f.d, fill: hexCourant.value })),
                  h('span', null, f.label)
                )
              )
            )
          ),
          h(
            'div',
            { ref: rv[2], class: 'groupe' },
            h('h3', null, 'Colour ', h('span', { class: 'valeur' }, nomCouleur.value)),
            h(
              'div',
              { class: 'pastilles', role: 'group', 'aria-label': 'Colour' },
              PALETTE_SITE.map((p) =>
                h('button', {
                  key: p.hex,
                  type: 'button',
                  class: 'pastille',
                  style: { background: p.hex },
                  'aria-label': p.nom,
                  'aria-pressed': couleur.value === p.hex,
                  onClick: () => poserCouleur(p.hex)
                })
              )
            ),
            h(
              'div',
              { class: 'libre' },
              h(
                'label',
                { class: 'libre-choix' },
                h('input', { type: 'color', value: hexCourant.value, 'aria-label': 'Pick any colour', onInput: (e: Event) => poserCouleur((e.target as HTMLInputElement).value) }),
                h('span', null, 'Any colour')
              ),
              h(
                'label',
                { class: 'libre-hex' },
                h('span', { class: 'sr-only' }, 'Hex code'),
                h('input', {
                  type: 'text',
                  value: texteHex.value,
                  maxlength: '7',
                  spellcheck: 'false',
                  autocomplete: 'off',
                  'aria-label': 'Hex colour code',
                  'aria-invalid': hexValide(texteHex.value) ? 'false' : 'true',
                  onInput: (e: Event) => saisirHex((e.target as HTMLInputElement).value),
                  onBlur: () => (texteHex.value = hexCourant.value)
                })
              )
            )
          ),
          h(
            'div',
            { ref: rv[3], class: 'groupe' },
            h('h3', null, 'Mood'),
            h(
              'div',
              { class: 'chips', role: 'group', 'aria-label': 'Mood' },
              HUMEURS_SITE.map((hm) => h('button', { key: hm.id, type: 'button', class: 'chip', 'aria-pressed': mood.value === hm.id, onClick: () => (mood.value = hm.id) }, hm.label))
            ),
            mood.value === 'travaille'
              ? h(
                  'label',
                  { key: 'ordi', class: 'case' },
                  h('input', { type: 'checkbox', checked: ordinateur.value, onChange: (e: Event) => (ordinateur.value = (e.target as HTMLInputElement).checked) }),
                  ' Show the laptop'
                )
              : null
          ),
          h(
            'div',
            { ref: rv[4], class: 'groupe' },
            h(
              'h3',
              null,
              'Accessories ',
              h('span', { class: 'valeur' }, `${nbPortes.value} worn`),
              nbPortes.value ? h('button', { key: 'tout', type: 'button', class: 'lien-btn', onClick: toutRetirer }, 'Remove all') : null
            ),
            h(
              'div',
              { class: 'onglets', role: 'tablist', 'aria-label': 'Accessory slot', onKeydown: clavierOnglets },
              EMPLACEMENTS_IDS.map((e) =>
                h(
                  'button',
                  {
                    key: e,
                    type: 'button',
                    role: 'tab',
                    class: 'onglet',
                    'aria-selected': s === e,
                    tabindex: s === e ? 0 : -1,
                    onClick: () => (slot.value = e)
                  },
                  EMPLACEMENT_LABEL[e],
                  choix.value[e].id ? h('span', { key: 'pt', class: 'onglet-point', 'aria-hidden': 'true' }) : null
                )
              )
            ),
            h(
              'div',
              { class: 'pieces', role: 'tabpanel', 'aria-label': EMPLACEMENT_LABEL[s] + ' accessories' },
              h(
                'button',
                { key: '__aucun', type: 'button', class: 'piece', 'aria-pressed': !ch.id, onClick: () => choisir(s, '') },
                h(
                  'span',
                  { class: 'piece-image aucun', 'aria-hidden': 'true' },
                  h(
                    'svg',
                    { viewBox: '0 0 24 24', width: '26', height: '26' },
                    h('circle', { cx: '12', cy: '12', r: '8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }),
                    h('path', { d: 'M6.5 17.5 17.5 6.5', stroke: 'currentColor', 'stroke-width': '1.6' })
                  )
                ),
                h('span', { class: 'piece-nom' }, 'None')
              ),
              options(s).map((o) =>
                h(
                  'button',
                  { key: s + ':' + o.id, type: 'button', class: 'piece', 'aria-pressed': ch.id === o.id, onClick: () => choisir(s, o.id) },
                  h('span', { class: 'piece-image', 'aria-hidden': 'true' }, h('img', { src: icone(s, o.id), alt: '', width: '60', height: '60', loading: 'lazy', decoding: 'async' })),
                  h('span', { class: 'piece-nom' }, o.label)
                )
              )
            ),
            ch.id
              ? h(
                  'div',
                  { key: 'couleurs', class: 'couleurs-piece' },
                  h(
                    'div',
                    { class: 'pastilles', role: 'group', 'aria-label': EMPLACEMENT_LABEL[s] + ' colour' },
                    PALETTE_ACC.map((cl) => pastille(cl, ch.c1 === cl.hex, () => poserC1(s, cl.hex)))
                  ),
                  aDeuxCouleurs(s)
                    ? h(
                        'div',
                        { key: 'c2', class: 'pastilles', role: 'group', 'aria-label': EMPLACEMENT_LABEL[s] + ' second colour' },
                        h('span', { class: 'pastilles-titre' }, 'Second colour'),
                        PALETTE_ACC.map((cl) => pastille(cl, ch.c2 === cl.hex, () => poser(s, { ...choix.value[s], c2: cl.hex }), ' (second colour)'))
                      )
                    : null
                )
              : null
          ),
          reduit.value ? h('p', { key: 'note', class: 'note' }, 'Reduced motion is on: the preview shows a still frame.') : null
        )
      ),
      h(
        'div',
        { ref: rv[5], class: 'wrap perso-code' },
        c(CodeBlock, { code: extrait.value, titre: 'index.html' }),
        h(
          'p',
          { class: 'note' },
          'Ids are the engine\'s own (in French for now: ',
          h('code', null, 'etoile'),
          ' is the star). See the ',
          h('a', { href: '/docs' }, 'docs'),
          ' for every option.'
        )
      )
    )
  }
}
