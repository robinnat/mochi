<script setup lang="ts">
import { ref } from 'vue'

const VUE_SFC = `<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from './components/MochiBot.vue'

const state = ref('idle')
<\/script>

<template>
  <MochiBot
    v-model:state="state"
    shape="fleur"
    color="rose"
    rendu="argile"
    :size="160"
    follow
  />
</template>`

const VUE_3D = `<!-- 3D: Three.js is loaded on demand, only when this style is used -->
<MochiBot shape="etoile" color="ambre" rendu="3d" contour :size="200" />

<!-- an accessory and its gesture -->
<MochiBot accessoire="portable" rendu="argile" :size="200" />

<!-- a frozen frame: no animation loop, same image every time -->
<MochiBot state="orbit" :frozen-at="1.2" :size="96" />`

const INSTALL = 'npm install mochi-bots'
const copie = ref('')
async function copier(texte: string, quoi: string) {
  try {
    await navigator.clipboard.writeText(texte)
    copie.value = quoi
    setTimeout(() => (copie.value = ''), 1600)
  } catch {
    // presse-papiers refuse : le texte reste selectionnable
  }
}
</script>

<template>
  <section id="install" class="bloc wrap" aria-labelledby="t-install">
    <span class="etiquette">Install</span>
    <h2 id="t-install">Use it in your own app<span class="bientot">Coming soon</span></h2>
    <p class="chapo">
      The package is not published yet, so the command below will not work today. It is the name it will ship
      under. Mochi is MIT licensed, built with Vue 3 and TypeScript, and the engine itself has no framework
      and no clock: <code>engine.sample(t)</code> is a pure function of time.
    </p>
    <div class="code ligne"><span>$ {{ INSTALL }}</span><button type="button" class="copier" @click="copier(INSTALL, 'i')">{{ copie === 'i' ? 'Copied' : 'Copy' }}</button></div>

    <div class="deux" style="margin-top: 22px">
      <div>
        <h3 style="font-size: 1rem">Vue</h3>
        <div class="code"><button type="button" class="copier" @click="copier(VUE_SFC, 'v')">{{ copie === 'v' ? 'Copied' : 'Copy' }}</button>{{ VUE_SFC }}</div>
      </div>
      <div>
        <h3 style="font-size: 1rem">Props</h3>
        <div class="code"><button type="button" class="copier" @click="copier(VUE_3D, 'p')">{{ copie === 'p' ? 'Copied' : 'Copy' }}</button>{{ VUE_3D }}</div>
        <p class="note" style="margin-top: 10px">
          Shapes, colours and expressions are ids from the catalogues (for now in French, so
          <code>etoile</code> is the star). <code>frozen-at</code> renders one exact instant with no animation
          loop, which is what the thumbnails on this page use.
        </p>
      </div>
    </div>
  </section>
</template>
