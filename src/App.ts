import { computed, ref, watch } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
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
import { nomDeCycle, t } from '@/i18n'
import { copie, copieTexte, cycleVersGif, cycleVersMp4, svgAutonome, telecharge, versGifAnime, versPng, versSvgAnime } from '@/ui/capture'
import {
  ACTION_BY_ID,
  ANIM_IMAGES,
  ANIM_PAS,
  CYCLE_TAILLE,
  FOND_GIF_DEFAUT,
  FORMAT_CYCLE_DEFAUT,
  GIF_IMAGES,
  GIF_PAS,
  BLANC,
  Abandon,
  couleurDeFond,
  cycleImages,
  cyclePas,
  nomFichier,
  type ActionId,
  type EtatExport,
  type FondGif,
  type FormatCycle
} from '@/ui/export'
import { HUMEURS } from '@/ui/gaze'
import { INTRO, INTRO_GAZE, POSE_AT, introDue } from '@/ui/intro'
import { ecris, lis, type NomStocke } from '@/ui/stockage'
import {
  estRendu,
  contourCourant,
  pixelCourant,
  PIXEL_DEFAUT,
  RENDU_DEFAUT,
  renduCourant,
  renduExportable,
  suffixeRendu,
  type RenduId,
  type TaillePixelId
} from '@/ui/rendu'
import { blockAt, blocksWith, defaultCycle, makeBlock, parseCycles, totalDuration, type Cycle } from '@/bot/cycles'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { POSES, SEQUENCE, STATES, type StateId } from '@/bot/states'

/**
 * L'URL pilote l'affichage : `#etat=wink&stop` ouvre un etat precis sequence a l'arret, `#planche` affiche la
 * planche. On relit a chaque `hashchange` pour que precedent et suivant du navigateur fonctionnent vraiment.
 */
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1))
  const asked = params.get('etat') as StateId | null
  // on ne fait jamais confiance a l'URL : l'etat doit exister
  const known = STATES.some((s) => s.id === asked)
  return {
    state: known ? asked! : 'idle',
    named: known,
    playing: !params.has('stop'),
    gallery: params.has('planche'),
    // `#arrivee` : rejouer l'arrivee sans avoir a revenir sur le site
    arrivee: params.has('arrivee')
  }
}

/**
 * Forme, couleur, expression et cycle survivent au rechargement : c'est l'avatar de l'utilisateur. On valide au
 * chargement, un id inconnu retombe sur le defaut.
 */
function stored(nom: NomStocke, fallback: string, exists: (v: string) => boolean) {
  const v = lis(nom)
  return v && exists(v) ? v : fallback
}

/**
 * Nom du produit, en capitales pour le grand mot du pied de page. PAS traduit : c'est une marque.
 */
const NOM = 'MOCHI'
/** Duree d'une humeur des reglages. Assez longue pour qu'on la remarque sans qu'elle agite. */
const HUMEUR_MS = 4200
/** Retard avant que la barre d'export se revele apres l'arrivee : le temps que l'avatar rejoigne sa place. */
const RETARD_ARRIVEE = 400
/** Duree d'affichage de la confirmation d'export. */
const CONFIRMATION_MS = 1800

/** Hors du lecteur, le montage joue est un unique bloc au repos (c'est la que la forme choisie se voit). */
const REST = [makeBlock('idle')]
/** Entree dans les reglages : le tourbillon, puis le repos (meme pose, la reprise ne se voit pas). */
const ENTREE = [makeBlock('swirl'), makeBlock('idle')]
/** Sous « mouvement reduit », l'entree va droit au repos : le tourbillon est de la decoration. */
const ENTREE_CALME = [makeBlock('idle')]

export const App: Composant<Record<string, never>> = () => {
  const initial = readHash()
  const gallery = ref(initial.gallery)

  /*
   * « Mouvement reduit » demande par le systeme, SUIVI et pas lu une seule fois. Ce qu'il coupe est de la
   * DECORATION (transitions, tourbillon d'entree) ; pas la respiration, le regard ni les clignements.
   */
  const calmeQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const calme = ref(calmeQuery.matches)
  calmeQuery.addEventListener('change', (e) => (calme.value = e.matches))

  // « venir » sur le site, c'est le navigateur qui le sait : `navigate` (et non `reload` ou `back_forward`)
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  const navigation = nav?.type ?? 'navigate'

  const intro = ref(
    initial.arrivee || introDue({ named: initial.named, gallery: initial.gallery, rechargement: navigation !== 'navigate', calme: calme.value })
  )

  /* ------------------------------------------------------------------ cycles */

  /** Le montage releve n'est qu'une amorce : ensuite les montages de l'utilisateur font foi. */
  const restored = parseCycles(lis('cycles'))
  const cycles = ref<Cycle[]>(restored.length ? restored : [defaultCycle()])

  const activeId = ref(stored('cycle', cycles.value[0]!.id, (v) => cycles.value.some((x) => x.id === v)))
  const block = ref(0)
  const elapsed = ref(0)
  const cycle = computed(() => cycles.value.find((x) => x.id === activeId.value) ?? cycles.value[0]!)

  /** Ou trouver un etat pour les liens `#etat=` : dans le montage courant s'il y est, sinon dans un autre. */
  function locate(id: StateId) {
    const ordre = [cycle.value, ...cycles.value.filter((x) => x.id !== activeId.value)]
    for (const x of ordre) {
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
  function enregistreCycles() {
    clearTimeout(pending)
    ecris('cycles', JSON.stringify(cycles.value))
  }
  watch(cycles, () => {
    clearTimeout(pending)
    pending = setTimeout(enregistreCycles, 250)
  })
  watch(activeId, (v) => ecris('cycle', v))
  // le differe se vide a la fermeture (`pagehide` : aussi au passage en cache de navigation sur mobile)
  window.addEventListener('pagehide', enregistreCycles)

  /* -------------------------------------------------------------------- affichages */

  // la personnalisation est l'accueil, sauf si l'URL designe un etat precis
  const view = ref<ViewId>(initial.named ? 'animations' : 'personnaliser')

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
  let ecritParNous = ''
  // l'URL est partageable, donc elle suit l'etat ET la lecture ; replace et pas push
  watch([state, playing], ([id, on]) => {
    // l'URL decrit le LECTEUR : hors de lui, l'etat affiche n'est qu'un decor
    if (view.value !== 'animations') return
    ecritParNous = `#etat=${id}${on ? '' : '&stop'}`
    location.replace(ecritParNous)
  })

  window.addEventListener('hashchange', () => {
    if (location.hash === ecritParNous) {
      ecritParNous = ''
      return
    }
    const next = readHash()
    // l'arrivee met en scene l'OUVERTURE de la page : on recharge pour la rejouer
    if (next.arrivee && !initial.arrivee) {
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
   * Le lecteur s'ouvre A L'ARRET, sauf un lien qui NOMME un etat (`#etat=`), qui decrit deja sa lecture.
   */
  let resume = initial.named && initial.playing
  let resumeBlock = block.value

  const played = computed(() => {
    if (intro.value) return INTRO
    if (view.value === 'animations') return cycle.value.blocks
    if (view.value !== 'reglages') return REST
    return calme.value ? ENTREE_CALME : ENTREE
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
    playing.value = now === 'reglages'
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
    if (view.value === 'reglages' && i > 0) playing.value = false
  })

  /** La boule est-elle encore seule en scene ? C'est la POSITION DU LECTEUR qui le dit. */
  const nue = computed(() => intro.value && block.value < POSE_AT)
  const gauche = computed(() => !nue.value && view.value === 'reglages')
  const droite = computed(() => !nue.value && view.value !== 'reglages')

  /* ------------------------------------------------------------------- skins */

  const shape = ref(stored('forme', DEFAULT_SHAPE, (v) => SHAPE_BY_ID.has(v)))
  const color = ref(stored('couleur', DEFAULT_COLOR, (v) => COLOR_BY_ID.has(v)))
  const expression = ref(stored('expression', DEFAULT_EXPRESSION, (v) => EXPRESSION_BY_ID.has(v)))
  watch(shape, (v) => ecris('forme', v))
  watch(color, (v) => ecris('couleur', v))
  watch(expression, (v) => ecris('expression', v))

  /** Style de rendu et taille des pixels, persistes ; poses aussi sur `renduCourant` / `pixelCourant`. */
  const rendu = ref<RenduId>(stored('style', RENDU_DEFAUT, estRendu) as RenduId)
  // densite des pixels : la plus fine, sans choix dans l'interface
  const pixel = ref<TaillePixelId>(PIXEL_DEFAUT)
  const contour = ref(stored('contour', '0', (v) => v === '0' || v === '1') === '1')
  renduCourant.value = rendu.value
  pixelCourant.value = pixel.value
  contourCourant.value = contour.value
  watch(contour, (v) => {
    contourCourant.value = v
    ecris('contour', v ? '1' : '0')
  })
  watch(rendu, (v) => {
    renduCourant.value = v
    ecris('style', v)
  })

  /** Ce que porte un bot exporte : la meme chose qu'a l'ecran, style compris. */
  const reglagesBot = () => ({
    shape: shape.value,
    color: color.value,
    expression: expression.value,
    // la vraie 3D est un canvas WebGL, que la serialisation du SVG n'emporte pas
    rendu: renduExportable(rendu.value),
    pixel: pixel.value
  })

  /* ----------------------------------------------------------------- humeurs */

  /**
   * La boule redevient RONDE le temps d'un tour (reglages, arrivee) : sur une autre forme, les yeux recolles au
   * contour sautilleraient. Le choix de l'utilisateur n'est pas touche, il revient en morphant.
   */
  const forme = computed(() => (view.value === 'reglages' || nue.value ? DEFAULT_SHAPE : shape.value))

  /** Dans les reglages, le bot change d'humeur de temps a autre : un vernis de page, pas un reglage. */
  const humeur = ref<string | null>(null)
  let humeurTimer: ReturnType<typeof setInterval> | undefined
  watch(view, (v) => {
    clearInterval(humeurTimer)
    if (v !== 'reglages') {
      humeur.value = null
      return
    }
    let i = 0
    humeurTimer = setInterval(() => {
      humeur.value = HUMEURS[i % HUMEURS.length]!
      i++
    }, HUMEUR_MS)
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
  const barreCachee = ref(false)
  let minuteurBarre: ReturnType<typeof setTimeout> | undefined
  watch(nue, (encore, avant) => {
    if (!avant || encore) return
    barreCachee.value = true
    clearTimeout(minuteurBarre)
    minuteurBarre = setTimeout(() => (barreCachee.value = false), RETARD_ARRIVEE)
  })

  const dialogueCycle = ref(false)
  const formatCycle = ref<FormatCycle>(FORMAT_CYCLE_DEFAUT)
  const fondCycle = ref<FondGif>(FOND_GIF_DEFAUT)
  /** `null` tant qu'on n'encode pas ; sinon la fraction faite. */
  const avancementCycle = ref<number | null>(null)
  /** Le dernier export de montage a-t-il echoue ? (la barre d'export n'est pas a l'ecran dans les Animations) */
  const erreurCycle = ref(false)
  let abandonCycle: AbortController | null = null

  /** Exporte le MONTAGE : le cycle courant est rejoue hors ecran, du debut a la fin. */
  async function exporteCycle() {
    if (avancementCycle.value !== null) return
    erreurCycle.value = false
    const controle = new AbortController()
    abandonCycle = controle
    const blocs = cycle.value.blocks
    const format = formatCycle.value
    const images = cycleImages(totalDuration(blocs), format)
    const pas = cyclePas(format)
    const taille = CYCLE_TAILLE[format]
    const reglages = reglagesBot()
    const suit = (fait: number, total: number) => (avancementCycle.value = fait / total)
    avancementCycle.value = 0
    try {
      const mp4 = format === 'mp4'
      // la video n'a pas d'alpha : elle impose le blanc ; le GIF garde le choix
      const fichier = mp4
        ? await cycleVersMp4(reglages, blocs, taille, images, pas, BLANC, suit, controle.signal)
        : await cycleVersGif(reglages, blocs, taille, images, pas, couleurDeFond(fondCycle.value), suit, controle.signal)
      telecharge(fichier, nomFichier(nomDeCycle(cycle.value), '', '', mp4 ? 'mp4' : 'gif'))
      dialogueCycle.value = false
    } catch (e) {
      // un abandon n'est pas un echec
      if (!(e instanceof Abandon)) erreurCycle.value = true
    } finally {
      avancementCycle.value = null
      abandonCycle = null
    }
  }
  const annuleCycle = () => abandonCycle?.abort()
  // l'echec appartient a la TENTATIVE : rouvrir la boite la rend neuve
  watch(dialogueCycle, (ouverte) => {
    if (ouverte) erreurCycle.value = false
  })

  const etatExport = ref<EtatExport>('pret')
  let confirmation: ReturnType<typeof setTimeout> | undefined
  /** Fond du GIF, et boite qui le demande (seul format a transparence sur un bit). */
  const fondGif = ref<FondGif>(FOND_GIF_DEFAUT)
  const dialogueGif = ref(false)

  /** Exporte l'avatar tel qu'il est AFFICHE : c'est le noeud vivant qui est serialise. */
  async function exporte(id: ActionId, confirme = false) {
    // garde SYNCHRONE : deux clics dans la meme image telechargeaient deux fois
    if (etatExport.value === 'occupe') return
    // le GIF demande son fond avant de partir ; la boite rappelle avec `confirme`
    if (!confirme && ACTION_BY_ID.get(id)?.mode === 'gif') {
      dialogueGif.value = true
      return
    }
    const action = ACTION_BY_ID.get(id)
    const svg = bot?.svg
    if (!action || !svg) return
    clearTimeout(confirmation)
    etatExport.value = 'occupe'
    const nom = () =>
      nomFichier(
        shape.value,
        expression.value,
        color.value,
        action.extension,
        // l'image fixe est le noeud AFFICHE (vraie 3D comprise) ; seules les animations repassent en argile
        [suffixeRendu(action.mode === 'anime' || action.mode === 'gif' ? renduExportable(rendu.value) : rendu.value), action.suffixe].filter(Boolean).join('-')
      )
    try {
      if (action.mode === 'anime') {
        // l'animation est rejouee depuis le debut sur une instance hors ecran
        telecharge(await versSvgAnime(reglagesBot(), action.taille, ANIM_IMAGES, ANIM_PAS), nom())
        etatExport.value = 'exporte'
      } else if (action.mode === 'gif') {
        telecharge(await versGifAnime(reglagesBot(), action.taille, GIF_IMAGES, GIF_PAS, couleurDeFond(fondGif.value)), nom())
        etatExport.value = 'exporte'
      } else {
        const markup = svgAutonome(svg, action.taille)
        if (action.mode === 'copieImage') {
          // le blob part en PROMESSE : cf. `copie` dans capture.ts
          await copie(versPng(markup, action.taille))
          etatExport.value = 'copie'
        } else if (action.mode === 'copieTexte') {
          await copieTexte(markup)
          etatExport.value = 'copie'
        } else {
          const fichier = action.extension === 'svg' ? new Blob([markup], { type: 'image/svg+xml' }) : await versPng(markup, action.taille)
          telecharge(fichier, nom())
          etatExport.value = 'exporte'
        }
      }
    } catch {
      // un refus du presse-papiers ou un encodage impossible ne doit pas laisser la barre sur « occupe »
      etatExport.value = 'erreur'
    }
    confirmation = setTimeout(() => (etatExport.value = 'pret'), CONFIRMATION_MS)
  }

  /** Rejoue l'entree a CHAQUE arrivee dans les reglages (apres que le lecteur a recu le nouveau montage). */
  watch(
    view,
    (v) => {
      if (v === 'reglages') bot?.seek(0, 0)
    },
    { flush: 'post' }
  )

  /* ------------------------------------------------------------------ dessin */

  const planche = () =>
    h(
      'div',
      { key: 'planche', class: 'p-5' },
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
        ? c(SideRail, { key: 'rail', view: v, onView: (x) => (view.value = x), class: 'rail', inert: nue.value || undefined })
        : // sortie d'apercu : le seul element qui reste a l'ecran avec l'avatar
          h(
            'button',
            {
              key: 'sortie',
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
            nue.value || pv ? 'scene--seule' : v === 'reglages' && 'scene--gauche'
          ]
        },
        // panneau des reglages, colonne de GAUCHE : c'est sa largeur qui l'escamote, pas un retrait
        !pv
          ? h(
              'aside',
              {
                key: 'gauche',
                class: [
                  'panneau scene__gauche w-full lg:flex lg:h-[calc(100dvh_-_3rem_-_var(--timeline))] lg:w-80 lg:shrink-0 lg:flex-col lg:justify-center lg:self-start lg:-translate-y-12 lg:pl-14',
                  gauche.value ? 'panneau--ouvert max-lg:order-2' : 'max-lg:hidden'
                ],
                // ferme, il n'est que transparent (sa colonne se referme) : sans `inert` ses champs restaient dans
                // l'ordre de tabulation et lus par les lecteurs d'ecran
                inert: !gauche.value,
                'aria-hidden': gauche.value ? undefined : 'true'
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
                nue.value && 'avatar--intro',
                v === 'reglages' && !pv && 'avatar--geant'
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
              shape: forme.value,
              color: color.value,
              expression: humeur.value ?? expression.value,
              follow: v === 'reglages',
              gaze: intro.value ? INTRO_GAZE : null
            })
          ),
          // barre d'export : hors du flux, calee sur la colonne de l'avatar ; masquee et inerte pendant l'arrivee
          v === 'personnaliser' && !pv
            ? h(
                'div',
                { key: 'export', class: ['barre-export', (nue.value || barreCachee.value) && 'barre-export--cachee'], inert: nue.value || barreCachee.value },
                c(ExportBar, { etat: etatExport.value, onExporter: (id) => exporte(id) })
              )
            : null,
          // les deux boites sont HORS de la barre d'export : `inert` neutraliserait aussi la couche superieure
          v === 'animations' && !pv
            ? c(CycleDialog, {
                key: 'dcycle',
                open: dialogueCycle.value,
                onOpen: (x) => (dialogueCycle.value = x),
                format: formatCycle.value,
                onFormat: (x) => (formatCycle.value = x),
                fond: fondCycle.value,
                onFond: (x) => (fondCycle.value = x),
                avancement: avancementCycle.value,
                erreur: erreurCycle.value,
                onConfirm: exporteCycle,
                onAnnuler: annuleCycle
              })
            : null,
          v === 'personnaliser' && !pv
            ? c(GifDialog, {
                key: 'dgif',
                open: dialogueGif.value,
                onOpen: (x) => (dialogueGif.value = x),
                fond: fondGif.value,
                onFond: (x) => (fondGif.value = x),
                onConfirm: () => exporte('gif', true)
              })
            : null
        ),
        // largeur fixe, identique dans les deux affichages : sinon la scene se decale au changement d'onglet
        !pv
          ? h(
              'aside',
              {
                key: 'droite',
                class: ['panneau scene__droite w-full lg:w-80 lg:shrink-0', droite.value ? 'panneau--ouvert max-lg:order-2' : 'max-lg:hidden'],
                // meme raison que le panneau de gauche : transparent n'est pas cache pour le clavier
                inert: !droite.value,
                'aria-hidden': droite.value ? undefined : 'true'
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
                    key: 'perso',
                    shape: shape.value,
                    onShape: (x) => (shape.value = x),
                    color: color.value,
                    onColor: (x) => (color.value = x),
                    expression: expression.value,
                    onExpression: (x) => (expression.value = x),
                    rendu: rendu.value,
                    onRendu: (x) => (rendu.value = x),
                    contour: contour.value,
                    onContour: (x) => (contour.value = x)
                  })
            )
          : null
      ),
      // le nom du projet, en grand, au niveau de la PAGE ; purement graphique
      v === 'reglages' && !pv ? h('p', { key: 'mot', class: 'wordmark', 'aria-hidden': 'true' }, NOM) : null,
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
            onExporter: () => (dialogueCycle.value = true)
          })
        : null
    )
  }

  return () => (gallery.value ? planche() : editeur())
}
