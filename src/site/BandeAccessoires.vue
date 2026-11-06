<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DefBande, ItemBande } from './bandes'
import { rendreVignette } from './vignettes'
import { useReduit } from './reduced'
import { themeEffectif } from './theme'

/**
 * Une bande d'accessoires : une ligne de Mochi qui defile en boucle (CSS pur, `transform`), avec pause au survol.
 * Les Mochi sont rendus une seule fois en images (`vignettes.ts`), quand la bande approche de l'ecran ;
 * le defilement ne coute donc aucun rendu 3D. Avec `prefers-reduced-motion`, la bande est figee (et se fait defiler a la main).
 */
const props = defineProps<{ def: DefBande; items: ItemBande[] }>()
const reduit = useReduit()
const racine = ref<HTMLElement | null>(null)
const visible = ref(false)
const urls = ref<(string | null)[]>(props.items.map(() => null))
const echec = ref(false)
let jeton = 0
let obs: IntersectionObserver | null = null
let aRendu = false

const libres = () => {
  for (const u of urls.value) if (u) URL.revokeObjectURL(u)
}

async function rendre() {
  const mon = ++jeton
  libres()
  urls.value = props.items.map(() => null)
  echec.value = false
  let reussis = 0
  for (let i = 0; i < props.items.length; i++) {
    // une image par tour d'horloge : le defilement de la page reste fluide pendant le rendu
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    if (mon !== jeton) return
    const u = await rendreVignette(props.items[i]!, themeEffectif.value)
    if (mon !== jeton) {
      if (u) URL.revokeObjectURL(u)
      return
    }
    if (u) {
      reussis++
      urls.value[i] = u
    } else if (i === 0) {
      echec.value = true
      return
    }
  }
  if (reussis === 0) echec.value = true
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !racine.value) {
    visible.value = true
    aRendu = true
    void rendre()
    return
  }
  obs = new IntersectionObserver(
    (entrees) => {
      const e = entrees[entrees.length - 1]
      if (!e) return
      visible.value = e.isIntersecting
      if (e.isIntersecting && !aRendu) {
        aRendu = true
        void rendre()
      }
    },
    { rootMargin: '240px' }
  )
  obs.observe(racine.value)
})
watch(themeEffectif, () => {
  if (aRendu) void rendre()
})
onBeforeUnmount(() => {
  jeton++
  obs?.disconnect()
  libres()
})

/** Deux exemplaires de la piste (le second est decoratif) : -50 % ramene exactement au depart. Figee : un seul, defilable a la main. */
const copies = computed(() => (reduit.value ? [0] : [0, 1]))
</script>

<template>
  <div ref="racine" class="bande" :class="{ figee: reduit }">
    <div class="bande-tete">
      <h3>{{ def.titre }}</h3>
      <p>{{ def.texte }}</p>
    </div>
    <div class="fenetre" :tabindex="reduit ? 0 : undefined" :role="reduit ? 'group' : undefined" :aria-label="reduit ? `${def.titre}, scroll sideways` : undefined">
      <div
        class="piste"
        :class="[def.sens, { enmarche: visible && !reduit }]"
        :style="{ '--duree': def.duree + 's' }"
      >
        <ul v-for="c in copies" :key="c" class="serie" :aria-hidden="c === 1 ? 'true' : undefined" :aria-label="c === 0 ? `${def.titre} examples` : undefined">
          <li v-for="(it, i) in items" :key="it.cle" class="vignette">
            <img v-if="urls[i]" :src="urls[i]!" :alt="c === 0 ? it.label : ''" width="128" height="128" decoding="async" draggable="false" />
            <span v-else class="vide" aria-hidden="true" />
          </li>
        </ul>
      </div>
    </div>
    <p v-if="echec" class="note">Previews are not available on this device.</p>
  </div>
</template>

<style scoped>
.bande {
  margin-top: 22px;
}
.bande-tete {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.bande-tete h3 {
  margin: 0;
  font-size: 1.05rem;
}
.bande-tete p {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
}
.fenetre {
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
}
.piste {
  display: flex;
  width: max-content;
  will-change: transform;
  transform: translate3d(0, 0, 0);
}
.serie {
  display: flex;
  flex: none;
  margin: 0;
  padding: 0;
  list-style: none;
}
.vignette {
  flex: none;
  width: 128px;
  height: 128px;
  margin: 6px 7px;
}
.vignette img,
.vignette .vide {
  display: block;
  width: 128px;
  height: 128px;
}
.vignette img {
  user-select: none;
  -webkit-user-drag: none;
}
.vignette .vide {
  border-radius: 38%;
  background: var(--accent-soft);
  opacity: 0.55;
  transform: scale(0.62);
}
/* defilement : une serie entiere, puis retour a zero sans saut (les deux series sont identiques) */
.piste.enmarche {
  animation: defile var(--duree, 40s) linear infinite;
}
.piste.droite.enmarche {
  animation-direction: reverse;
}
.fenetre:hover .piste.enmarche,
.fenetre:focus-within .piste.enmarche {
  animation-play-state: paused;
}
@keyframes defile {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-50%, 0, 0);
  }
}
/* figee : pas de boucle, mais on peut faire defiler a la main */
.figee .fenetre {
  overflow-x: auto;
  -webkit-mask-image: none;
  mask-image: none;
}
.figee .piste {
  animation: none !important;
  will-change: auto;
}
@media (prefers-reduced-motion: reduce) {
  .piste {
    animation: none !important;
  }
}
</style>
