<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { choisirTheme, themeEffectif } from './theme'

const reduit = useReduit()
</script>

<template>
  <section id="theme" class="bloc wrap" aria-labelledby="t-theme">
    <span class="etiquette">Theme</span>
    <h2 id="t-theme">Light and dark mode</h2>
    <p class="chapo">
      The same Mochi in both themes. In dark mode the eyes turn black, and the body is lightened only if it would not
      contrast enough with them. <code>theme="light"</code> or <code>theme="dark"</code> sets it for one avatar; without
      it, Mochi follows the page, and the page follows your device by default.
    </p>
    <div class="deux" style="margin-top: 26px">
      <figure class="scene clair">
        <Lazy :largeur="220" :hauteur="220">
          <MochiBot :size="210" shape="etoile" color="ambre" rendu="3d" mood="repos" theme="light" :frozen-at="reduit ? 1 : undefined" label="A yellow star Mochi in light mode, white eyes" />
        </Lazy>
        <figcaption>Light</figcaption>
      </figure>
      <figure class="scene sombre">
        <Lazy :largeur="220" :hauteur="220">
          <MochiBot :size="210" shape="etoile" color="ambre" rendu="3d" mood="repos" theme="dark" :frozen-at="reduit ? 1 : undefined" label="The same Mochi in dark mode, black eyes" />
        </Lazy>
        <figcaption>Dark</figcaption>
      </figure>
    </div>
    <div class="actions" style="justify-content: flex-start">
      <button type="button" class="btn primaire" @click="choisirTheme(themeEffectif === 'dark' ? 'light' : 'dark')">
        Switch the whole page to {{ themeEffectif === 'dark' ? 'light' : 'dark' }}
      </button>
      <button type="button" class="btn" @click="choisirTheme('auto')">Follow my device</button>
    </div>
  </section>
</template>

<style scoped>
.scene.clair {
  background: #fbfaf7;
  border-color: #e9e6df;
}
.scene.sombre {
  background: #1e1d27;
  border-color: #2f2d3b;
}
figure.scene {
  margin: 0;
  gap: 4px;
}
figcaption {
  font-size: 0.85rem;
  color: #8a8794;
}
</style>
