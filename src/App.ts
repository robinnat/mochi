import { computed, ref, watch } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import type { MochiBotElement } from '@/components/mochi-bot'
import '@/components/mochi-bot'
import { BotTile } from '@/components/BotTile'
import { Customizer } from '@/components/Customizer'
import { ExportBar } from '@/components/ExportBar'
import { CycleDialog } from '@/components/CycleDialog'
import { GifDialog } from '@/components/GifDialog'
import { Settings } from '@/components/Settings'
import { SideRail, type ViewId } from '@/components/SideRail'
import { Timeline } from '@/components/Timeline'
import { nameOfCycle, t } from '@/i18n'
import { copy, copyText, cycleToGif, cycleToMp4, svgStandalone, download, toGifAnimate, toPng } from '@/ui/capture'
import {
  ACTION_BY_ID,
  CYCLE_SIZE,
  DEFAULT_GIF_BACKGROUND,
  DEFAULT_CYCLE_FORMAT,
  GIF_IMAGES,
  GIF_STEP,
  WHITE,
  Abandon,
  backgroundColor,
  cycleImages,
  cycleStep,
  nameFile,
  type ActionId,
  type StateExport,
  type BackgroundGif,
  type FormatCycle
} from '@/ui/export'
import { MOODS } from '@/ui/gaze'
import { INTRO, INTRO_GAZE, POSE_AT, introDue } from '@/ui/intro'
import { write, read, type NameStored } from '@/ui/storage'
import {
  isRenderStyle,
  currentOutline,
  currentPixel,
  DEFAULT_PIXEL,
  DEFAULT_RENDER_STYLE,
  currentRenderStyle,
  renderStyleSuffix,
  type RenderStyleId,
  type PixelSizeId
} from '@/ui/renderStyle'
import { blockAt, blocksWith, defaultCycle, makeBlock, parseCycles, totalDuration, type Cycle } from '@/bot/cycles'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { POSES, SEQUENCE, STATES, type StateId } from '@/bot/states'

/**
 * L'URL pilote l'affichage : `#state=wink&stop` ouvre un etat precis sequence a l'arret, `#sheet` affiche la
 * planche. On relit a chaque `hashchange` pour que precedent et suivant du navigateur fonctionnent vraiment.
 */
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1))
  const asked = params.get('state') as StateId | null
  // on ne fait jamais confiance a l'URL : l'etat doit exister
  const known = STATES.some((s) => s.id === asked)
  return {
    state: known ? asked! : 'idle',
    named: known,
    playing: !params.has('stop'),
    gallery: params.has('sheet'),
    // `#arrival` : rejouer l'arrivee sans avoir a revenir sur le site
    arrival: params.has('arrival')
  }
}

/**
 * Forme, couleur, expression et cycle survivent au rechargement : c'est l'avatar de l'utilisateur. On valide au
 * chargement, un id inconnu retombe sur le defaut.
 */
function stored(name: NameStored, fallback: string, exists: (v: string) => boolean) {
  const v = read(name)
  return v && exists(v) ? v : fallback
}

/**
 * Nom du produit, en capitales pour le grand mot du pied de page. PAS traduit : c'est une marque.
 */
const NAME = 'MOCHI'
/** Duree d'une humeur des reglages. Assez longue pour qu'on la remarque sans qu'elle agite. */
const MOOD_MS = 4200
/** Retard avant que la barre d'export se revele apres l'arrivee : le temps que l'avatar rejoigne sa place. */
const ARRIVAL_DELAY = 400
/** Duree d'affichage de la confirmation d'export. */
const CONFIRMATION_MS = 1800

/** Hors du lecteur, le montage joue est un unique bloc au repos (c'est la que la forme choisie se voit). */
const REST = [makeBlock('idle')]
/** Entree dans les reglages : le tourbillon, puis le repos (meme pose, la reprise ne se voit pas). */
const ENTRY = [makeBlock('swirl'), makeBlock('idle')]
/** Sous « mouvement reduit », l'entree va droit au repos : le tourbillon est de la decoration. */
const ENTRY_CALM = [makeBlock('idle')]

export const App: Component<Record<string, never>> = () => {
  const initial = readHash()
  const gallery = ref(initial.gallery)

  /*
   * « Mouvement reduit » demande par le systeme, SUIVI et pas lu une seule fois. Ce qu'il coupe est de la
   * DECORATION (transitions, tourbillon d'entree) ; pas la respiration, le regard ni les clignements.
   */
  const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const calm = ref(calmQuery.matches)
  calmQuery.addEventListener('change', (e) => (calm.value = e.matches))

  // « venir » sur le site, c'est le navigateur qui le sait : `navigate` (et non `reload` ou `back_forward`)
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  const navigation = nav?.type ?? 'navigate'

  const intro = ref(
    initial.arrival || introDue({ named: initial.named, gallery: initial.gallery, reload: navigation !== 'navigate', calm: calm.value })
  )

  /* ------------------------------------------------------------------ cycles */

  /** Le montage releve n'est qu'une amorce : ensuite les montages de l'utilisateur font foi. */
  const restored = parseCycles(read('cycles'))
  const cycles = ref<Cycle[]>(restored.length ? restored : [defaultCycle()])

  const activeId = ref(stored('cycle', cycles.value[0]!.id, (v) => cycles.value.some((x) => x.id === v)))
  const block = ref(0)
  const elapsed = ref(0)
  const cycle = computed(() => cycles.value.find((x) => x.id === activeId.value) ?? cycles.value[0]!)

  /** Ou trouver un etat pour les liens `#state=` : dans le montage courant s'il y est, sinon dans un autre. */
  function locate(id: StateId) {
    const order = [cycle.value, ...cycles.value.filter((x) => x.id !== activeId.value)]
    for (const x of order) {
      const index = x.blocks.findIndex((b) => b.state === id)
      if (index >= 0) return { id: x.id, index }
    }
    return null
  }

  // un lien vers un etat precis ouvre le montage qui le contient
  if (initial.named) {
    const found = locate(initial.state)
    if (found) {
      activeId.value = found.id
      block.value = found.index
    }
  }

  // l'etat est une sortie du lecteur ; a l'arrivee, il part du REPOS quel que soit le montage
  const state = ref<StateId>(intro.value ? 'idle' : (cycle.value.blocks[block.value]?.state ?? 'idle'))

  /** Ecriture differee : etirer une carte remplace le cycle a chaque mouvement, et `localStorage` est synchrone. */
  let pending: ReturnType<typeof setTimeout>
  function savedCycles() {
    clearTimeout(pending)
    write('cycles', JSON.stringify(cycles.value))
  }
  watch(cycles, () => {
    clearTimeout(pending)
    pending = setTimeout(savedCycles, 250)
  })
  watch(activeId, (v) => write('cycle', v))
  // le differe se vide a la fermeture (`pagehide` : aussi au passage en cache de navigation sur mobile)
  window.addEventListener('pagehide', savedCycles)

  /* -------------------------------------------------------------------- affichages */

  // la personnalisation est l'accueil, sauf si l'URL designe un etat precis
  const view = ref<ViewId>(initial.named ? 'animations' : 'customize')

  /** Apercu : la scene seule. On en sort par Echap ou par le bouton. */
  const preview = ref(false)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') preview.value = false
  })

  // on ne joue pas la sequence en personnalisation, sinon la forme est illisible
  const playing = ref(intro.value || (initial.playing && view.value === 'animations'))
  /** L'apercu commande la lecture dans les deux sens : on y entre en lecture, on en sort en pause. */
  watch(preview, (on) => {
    playing.value = on
  })

  /**
   * Le dernier fragment que NOUS avons ecrit, en attente de son `hashchange` : sans lui, un etat en double dans le
   * montage ramenait la tete de lecture a sa premiere occurrence. Consomme a la premiere lecture.
   */
  let writtenByUs = ''
  // l'URL est partageable, donc elle suit l'etat ET la lecture ; replace et pas push
  watch([state, playing], ([id, on]) => {
    // l'URL decrit le LECTEUR : hors de lui, l'etat affiche n'est qu'un decor
    if (view.value !== 'animations') return
    writtenByUs = `#state=${id}${on ? '' : '&stop'}`
    location.replace(writtenByUs)
  })

  window.addEventListener('hashchange', () => {
    if (location.hash === writtenByUs) {
      writtenByUs = ''
      return
    }
    const next = readHash()
    // l'arrivee met en scene l'OUVERTURE de la page : on recharge pour la rejouer
    if (next.arrival && !initial.arrival) {
      location.reload()
      return
    }
    gallery.value = next.gallery
    if (next.gallery) return
    // seul un lien qui NOMME un etat deplace la lecture
    if (!next.named) return
    const found = locate(next.state)
    if (!found) return
    view.value = 'animations'
    activeId.value = found.id
    block.value = found.index
  })

  /*
   * Le lecteur s'ouvre A L'ARRET, sauf un lien qui NOMME un etat (`#state=`), qui decrit deja sa lecture.
   */
  let resume = initial.named && initial.playing
  let resumeBlock = block.value

  const played = computed(() => {
    if (intro.value) return INTRO
    if (view.value === 'animations') return cycle.value.blocks
    if (view.value !== 'settings') return REST
    return calm.value ? ENTRY_CALM : ENTRY
  })

  watch(view, (now, before) => {
    // changer d'affichage interrompt l'arrivee
    intro.value = false
    // on ne memorise la position qu'en QUITTANT le lecteur
    if (before === 'animations') {
      resume = playing.value
      resumeBlock = block.value
    }
    if (now === 'animations') {
      playing.value = resume
      block.value = resumeBlock
      return
    }
    block.value = 0
    // seuls les reglages jouent quelque chose hors du lecteur : leur tourbillon d'entree
    playing.value = now === 'settings'
  })

  /** Une entree ne se joue qu'une fois : des que le lecteur atteint son bloc de repos, on coupe l'enchainement. */
  watch(block, (i) => {
    if (intro.value) {
      if (i >= INTRO.length - 1) {
        intro.value = false
        playing.value = false
      }
      return
    }
    if (view.value === 'settings' && i > 0) playing.value = false
  })

  /** La boule est-elle encore seule en scene ? C'est la POSITION DU LECTEUR qui le dit. */
  const bare = computed(() => intro.value && block.value < POSE_AT)
  const left = computed(() => !bare.value && view.value === 'settings')
  const right = computed(() => !bare.value && view.value !== 'settings')

  /* ------------------------------------------------------------------- skins */

  const shape = ref(stored('shape', DEFAULT_SHAPE, (v) => SHAPE_BY_ID.has(v)))
  const color = ref(stored('color', DEFAULT_COLOR, (v) => COLOR_BY_ID.has(v)))
  const expression = ref(stored('expression', DEFAULT_EXPRESSION, (v) => EXPRESSION_BY_ID.has(v)))
  watch(shape, (v) => write('shape', v))
  watch(color, (v) => write('color', v))
  watch(expression, (v) => write('expression', v))

  /** Style de rendu et taille des pixels, persistes ; poses aussi sur `currentRenderStyle` / `currentPixel`. */
  const renderStyle = ref<RenderStyleId>(stored('style', DEFAULT_RENDER_STYLE, isRenderStyle) as RenderStyleId)
  // densite des pixels : la plus fine, sans choix dans l'interface
  const pixel = ref<PixelSizeId>(DEFAULT_PIXEL)
  const outline = ref(stored('outline', '0', (v) => v === '0' || v === '1') === '1')
  currentRenderStyle.value = renderStyle.value
  currentPixel.value = pixel.value
  currentOutline.value = outline.value
  watch(outline, (v) => {
    currentOutline.value = v
    write('outline', v ? '1' : '0')
  })
  watch(renderStyle, (v) => {
    currentRenderStyle.value = v
    write('style', v)
  })

  /** Ce que porte un bot exporte : la meme chose qu'a l'ecran, style compris. */
  const settingsBot = () => ({
    shape: shape.value,
    color: color.value,
    expression: expression.value,
    // les animations sont rendues en 3D, image par image, dans le style de l'ecran
    renderStyle: renderStyle.value,
    pixel: pixel.value
  })

  /* ----------------------------------------------------------------- humeurs */

  /**
   * La boule redevient RONDE le temps d'un tour (reglages, arrivee) : sur une autre forme, les yeux recolles au
   * contour sautilleraient. Le choix de l'utilisateur n'est pas touche, il revient en morphant.
   */
  const displayShape = computed(() => (view.value === 'settings' || bare.value ? DEFAULT_SHAPE : shape.value))

  /** Dans les reglages, le bot change d'humeur de temps a autre : un vernis de page, pas un reglage. */
  const mood = ref<string | null>(null)
  let moodTimer: ReturnType<typeof setInterval> | undefined
  watch(view, (v) => {
    clearInterval(moodTimer)
    if (v !== 'settings') {
      mood.value = null
      return
    }
    let i = 0
    moodTimer = setInterval(() => {
      mood.value = MOODS[i % MOODS.length]!
      i++
    }, MOOD_MS)
  })

  const order = SEQUENCE.map((id) => STATES.find((s) => s.id === id)!)

  /** Ajoute une animation a la fin du montage courant. */
  function addBlock(id: StateId) {
    cycles.value = cycles.value.map((x) => (x.id === cycle.value.id ? { ...x, blocks: blocksWith(x.blocks, id) } : x))
  }

  /** Le lecteur est le seul a pouvoir recaler le moteur (il tient l'horloge), d'ou l'appel direct. */
  let bot: MochiBotElement | null = null
  function onSeek(s: number) {
    const { index, elapsed: offset } = blockAt(cycle.value.blocks, s)
    bot?.seek(index, offset)
  }

  /* ------------------------------------------------------------------ export */

  /** Barre masquee le temps que la scene se cale, seulement apres l'arrivee. */
  const barHidden = ref(false)
  let timerBar: ReturnType<typeof setTimeout> | undefined
  watch(bare, (again, before) => {
    if (!before || again) return
    barHidden.value = true
    clearTimeout(timerBar)
    timerBar = setTimeout(() => (barHidden.value = false), ARRIVAL_DELAY)
  })

  const dialogCycle = ref(false)
  const formatCycle = ref<FormatCycle>(DEFAULT_CYCLE_FORMAT)
  const backgroundCycle = ref<BackgroundGif>(DEFAULT_GIF_BACKGROUND)
  /** `null` tant qu'on n'encode pas ; sinon la fraction faite. */
  const progressCycle = ref<number | null>(null)
  /** Le dernier export de montage a-t-il echoue ? (la barre d'export n'est pas a l'ecran dans les Animations) */
  const errorCycle = ref(false)
  let abandonCycle: AbortController | null = null

  /** Exporte le MONTAGE : le cycle courant est rejoue hors ecran, du debut a la fin. */
  async function exportCycle() {
    if (progressCycle.value !== null) return
    errorCycle.value = false
    const check = new AbortController()
    abandonCycle = check
    const blocks = cycle.value.blocks
    const format = formatCycle.value
    const images = cycleImages(totalDuration(blocks), format)
    const step = cycleStep(format)
    const size = CYCLE_SIZE[format]
    const settings = settingsBot()
    const suit = (done: number, total: number) => (progressCycle.value = done / total)
    progressCycle.value = 0
    try {
      const mp4 = format === 'mp4'
      // la video n'a pas d'alpha : elle impose le blanc ; le GIF garde le choix
      const file = mp4
        ? await cycleToMp4(settings, blocks, size, images, step, WHITE, suit, check.signal)
        : await cycleToGif(settings, blocks, size, images, step, backgroundColor(backgroundCycle.value), suit, check.signal)
      download(file, nameFile(nameOfCycle(cycle.value), '', '', mp4 ? 'mp4' : 'gif'))
      dialogCycle.value = false
    } catch (e) {
      // un abandon n'est pas un echec
      if (!(e instanceof Abandon)) errorCycle.value = true
    } finally {
      progressCycle.value = null
      abandonCycle = null
    }
  }
  const cancelsCycle = () => abandonCycle?.abort()
  // l'echec appartient a la TENTATIVE : rouvrir la boite la rend neuve
  watch(dialogCycle, (open) => {
    if (open) errorCycle.value = false
  })

  const stateExport = ref<StateExport>('ready')
  let confirmation: ReturnType<typeof setTimeout> | undefined
  /** Fond du GIF, et boite qui le demande (seul format a transparence sur un bit). */
  const backgroundGif = ref<BackgroundGif>(DEFAULT_GIF_BACKGROUND)
  const dialogGif = ref(false)

  /** Exporte l'avatar tel qu'il est AFFICHE : c'est le noeud vivant qui est serialise. */
  async function runExport(id: ActionId, confirmed = false) {
    // garde SYNCHRONE : deux clics dans la meme image telechargeaient deux fois
    if (stateExport.value === 'busy') return
    // le GIF demande son fond avant de partir ; la boite rappelle avec `confirmed`
    if (!confirmed && ACTION_BY_ID.get(id)?.mode === 'gif') {
      dialogGif.value = true
      return
    }
    const action = ACTION_BY_ID.get(id)
    const svg = bot?.svg
    if (!action || !svg) return
    clearTimeout(confirmation)
    stateExport.value = 'busy'
    const name = () =>
      nameFile(
        shape.value,
        expression.value,
        color.value,
        action.extension,
        [renderStyleSuffix(renderStyle.value), action.suffix].filter(Boolean).join('-')
      )
    try {
      if (action.mode === 'gif') {
        // l'animation est rejouee depuis le debut sur une instance hors ecran, en 3D
        download(await toGifAnimate(settingsBot(), action.size, GIF_IMAGES, GIF_STEP, backgroundColor(backgroundGif.value)), name())
        stateExport.value = 'export'
      } else {
        const markup = svgStandalone(svg, action.size)
        if (action.mode === 'copyImage') {
          // le blob part en PROMESSE : cf. `copy` dans capture.ts
          await copy(toPng(markup, action.size))
          stateExport.value = 'copy'
        } else if (action.mode === 'copyText') {
          await copyText(markup)
          stateExport.value = 'copy'
        } else {
          const file = action.extension === 'svg' ? new Blob([markup], { type: 'image/svg+xml' }) : await toPng(markup, action.size)
          download(file, name())
          stateExport.value = 'export'
        }
      }
    } catch {
      // un refus du presse-papiers ou un encodage impossible ne doit pas laisser la barre sur « occupe »
      stateExport.value = 'error'
    }
    confirmation = setTimeout(() => (stateExport.value = 'ready'), CONFIRMATION_MS)
  }

  /** Rejoue l'entree a CHAQUE arrivee dans les reglages (apres que le lecteur a recu le nouveau montage). */
  watch(
    view,
    (v) => {
      if (v === 'settings') bot?.seek(0, 0)
    },
    { flush: 'post' }
  )

  /* ------------------------------------------------------------------ dessin */

  const sheet = () =>
    h(
      'div',
      { key: 'sheet', class: 'p-5' },
      h('a', { class: 'text-xs text-[var(--muted)] underline underline-offset-2', href: '#' }, t('gallery.back')),
      h(
        'div',
        { class: 'mt-4 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3' },
        order.map((s) =>
          h(
            'figure',
            { key: s.id, class: 'flex flex-col items-center' },
            h('mochi-bot', { state: s.id, size: 210, shape: shape.value, color: color.value, expression: expression.value, frozenAt: POSES[s.id] }),
            h('figcaption', { class: 'text-xs text-[var(--muted)]' }, t(`states.${s.id}`))
          )
        )
      )
    )

  const editeur = () => {
    const v = view.value
    const pv = preview.value
    return h(
      'div',
      { key: 'editeur', style: 'display: contents' },
      // titre de structure : un document sans h1 n'est pas navigable au lecteur d'ecran
      h('h1', { class: 'sr-only' }, t('app.name')),
      // pendant l'arrivee la barre reste montee mais inerte (sinon elle resterait dans l'ordre de tabulation)
      !pv
        ? c(SideRail, { key: 'rail', view: v, onView: (x) => (view.value = x), class: 'rail', inert: bare.value || undefined })
        : // sortie d'apercu : le seul element qui reste a l'ecran avec l'avatar
          h(
            'button',
            {
              key: 'exit',
              type: 'button',
              class:
                'fixed top-5 right-5 z-30 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-sm backdrop-blur transition hover:text-[var(--ink)]',
              onClick: () => (preview.value = false)
            },
            t('preview.exit'),
            h('kbd', { class: 'rounded bg-black/5 px-1 py-0.5 text-[10px]' }, t('preview.key'))
          ),
      // la place de la barre de montage n'est reservee QUE la ou elle existe
      h(
        'div',
        {
          key: 'scene',
          class: [
            'scene min-h-full items-stretch justify-center p-8 max-lg:flex max-lg:flex-col max-lg:gap-10 max-lg:px-5',
            !pv && v === 'animations' && 'pb-[calc(var(--timeline)_+_1rem)]',
            // sous 64rem le rail passe en bande HAUTE : la scene lui reserve sa hauteur (sauf en apercu)
            !pv && 'max-lg:pt-20',
            bare.value || pv ? 'scene--alone' : v === 'settings' && 'scene--left'
          ]
        },
        // panneau des reglages, colonne de GAUCHE : c'est sa largeur qui l'escamote, pas un retrait
        !pv
          ? h(
              'aside',
              {
                key: 'left',
                class: [
                  'panneau scene__gauche w-full lg:flex lg:h-[calc(100dvh_-_3rem_-_var(--timeline))] lg:w-80 lg:shrink-0 lg:flex-col lg:justify-center lg:self-start lg:-translate-y-12 lg:pl-14',
                  left.value ? 'panneau--ouvert max-lg:order-2' : 'max-lg:hidden'
                ],
                // ferme, il n'est que transparent (sa colonne se referme) : sans `inert` ses champs restaient dans
                // l'ordre de tabulation et lus par les lecteurs d'ecran
                inert: !left.value,
                'aria-hidden': left.value ? undefined : 'true'
              },
              c(Settings, {})
            )
          : null,
        // scene : sa hauteur ne depend pas du panneau de droite
        h(
          'main',
          {
            key: 'main',
            class: [
              'scene__avatar relative flex flex-1 items-center justify-center max-lg:order-1 max-lg:flex-col max-lg:gap-4 lg:self-start',
              pv ? 'lg:min-h-[calc(100dvh_-_4rem)]' : 'lg:min-h-[calc(100dvh_-_3rem_-_var(--timeline))]'
            ]
          },
          // l'avatar se met a la hauteur disponible
          h(
            'div',
            {
              class: [
                'avatar flex aspect-square w-full items-center justify-center',
                pv ? 'max-w-[min(560px,calc(100dvh_-_6rem))]' : 'max-w-[min(460px,calc(100dvh_-_var(--timeline)_-_7rem))]',
                bare.value && 'avatar--intro',
                v === 'settings' && !pv && 'avatar--giant'
              ]
            },
            h('mochi-bot', {
              ref: (el: Element | null) => (bot = el as MochiBotElement | null),
              class: 'h-auto max-w-full',
              state: state.value,
              block: block.value,
              elapsed: elapsed.value,
              playing: playing.value,
              onStatechange: (e: CustomEvent<StateId>) => (state.value = e.detail),
              onBlockchange: (e: CustomEvent<number>) => (block.value = e.detail),
              onElapsedchange: (e: CustomEvent<number>) => (elapsed.value = e.detail),
              onPlayingchange: (e: CustomEvent<boolean>) => (playing.value = e.detail),
              cycle: played.value,
              size: pv ? 560 : 440,
              shape: displayShape.value,
              color: color.value,
              expression: mood.value ?? expression.value,
              follow: v === 'settings',
              gaze: intro.value ? INTRO_GAZE : null
            })
          ),
          // barre d'export : hors du flux, calee sur la colonne de l'avatar ; masquee et inerte pendant l'arrivee
          v === 'customize' && !pv
            ? h(
                'div',
                { key: 'export', class: ['bar-export', (bare.value || barHidden.value) && 'bar-export--hidden'], inert: bare.value || barHidden.value },
                c(ExportBar, { state: stateExport.value, onExporter: (id) => runExport(id) })
              )
            : null,
          // les deux boites sont HORS de la barre d'export : `inert` neutraliserait aussi la couche superieure
          v === 'animations' && !pv
            ? c(CycleDialog, {
                key: 'dcycle',
                open: dialogCycle.value,
                onOpen: (x) => (dialogCycle.value = x),
                format: formatCycle.value,
                onFormat: (x) => (formatCycle.value = x),
                background: backgroundCycle.value,
                onBackground: (x) => (backgroundCycle.value = x),
                progress: progressCycle.value,
                error: errorCycle.value,
                onConfirm: exportCycle,
                onCancel: cancelsCycle
              })
            : null,
          v === 'customize' && !pv
            ? c(GifDialog, {
                key: 'dgif',
                open: dialogGif.value,
                onOpen: (x) => (dialogGif.value = x),
                background: backgroundGif.value,
                onBackground: (x) => (backgroundGif.value = x),
                onConfirm: () => runExport('gif', true)
              })
            : null
        ),
        // largeur fixe, identique dans les deux affichages : sinon la scene se decale au changement d'onglet
        !pv
          ? h(
              'aside',
              {
                key: 'right',
                class: ['panneau scene__droite w-full lg:w-80 lg:shrink-0', right.value ? 'panneau--ouvert max-lg:order-2' : 'max-lg:hidden'],
                // meme raison que le panneau de gauche : transparent n'est pas cache pour le clavier
                inert: !right.value,
                'aria-hidden': right.value ? undefined : 'true'
              },
              v === 'animations'
                ? [
                    h('h2', { key: 'ta', class: 'text-sm font-semibold' }, t('panel.animations')),
                    h(
                      'div',
                      { key: 'ga', class: 'mt-2 grid grid-cols-4 gap-1.5' },
                      order.map((s) =>
                        c(BotTile, {
                          key: s.id,
                          label: t(`states.${s.id}`),
                          selected: s.id === state.value,
                          state: s.id,
                          shape: shape.value,
                          color: color.value,
                          expression: expression.value,
                          frozenAt: POSES[s.id],
                          onClick: () => addBlock(s.id)
                        })
                      )
                    )
                  ]
                : c(Customizer, {
                    key: 'custom',
                    shape: shape.value,
                    onShape: (x) => (shape.value = x),
                    color: color.value,
                    onColor: (x) => (color.value = x),
                    expression: expression.value,
                    onExpression: (x) => (expression.value = x),
                    renderStyle: renderStyle.value,
                    onRender: (x) => (renderStyle.value = x),
                    outline: outline.value,
                    onOutline: (x) => (outline.value = x)
                  })
            )
          : null
      ),
      // le nom du projet, en grand, au niveau de la PAGE ; purement graphique
      v === 'settings' && !pv ? h('p', { key: 'word', class: 'wordmark', 'aria-hidden': 'true' }, NAME) : null,
      v === 'animations' && !pv
        ? c(Timeline, {
            key: 'timeline',
            cycles: cycles.value,
            onCycles: (x) => (cycles.value = x),
            activeId: activeId.value,
            onActiveId: (x) => (activeId.value = x),
            block: block.value,
            onBlock: (x) => (block.value = x),
            playing: playing.value,
            onPlaying: (x) => (playing.value = x),
            elapsed: elapsed.value,
            shape: shape.value,
            color: color.value,
            expression: expression.value,
            onSeek,
            onPreview: () => (preview.value = true),
            onExporter: () => (dialogCycle.value = true)
          })
        : null
    )
  }

  return () => (gallery.value ? sheet() : editeur())
}
