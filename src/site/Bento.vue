<script setup lang="ts">
import Affiche from './Affiche.vue'
import AccDefile from './AccDefile.vue'
import BandePieces from './BandePieces.vue'
import { CATALOGUE, EMPLACEMENTS } from '@/bot/emplacements'
import { EMPLACEMENT_LABEL } from './catalog'

/** Le reste, en cartes : clair et sombre, accessoires, chargement a la demande, moteur pur, exports. Images figees seulement. */
const N_ACC = CATALOGUE.length
const N_EMPL = EMPLACEMENTS.length
const NOMS_EMPL = EMPLACEMENTS.map((e) => EMPLACEMENT_LABEL[e].toLowerCase()).join(', ')
</script>

<template>
  <section id="more" class="sec" aria-labelledby="t-plus">
    <div class="wrap sec-tete">
      <p v-reveal class="surtitre">And more</p>
      <h2 id="t-plus" v-reveal="1" class="titre-sec">Small engine.<br />Lots of care.</h2>
    </div>
    <div class="wrap bento">
      <article v-reveal="0" class="carte-b b-theme">
        <div class="b-duo">
          <div class="b-clair">
            <Affiche nom="bento-clair" :taille="146" alt="A yellow star Mochi in light mode, white eyes" />
          </div>
          <div class="b-sombre">
            <Affiche nom="bento-sombre" :taille="146" alt="The same Mochi in dark mode, black eyes" />
          </div>
        </div>
        <h3>Light and dark</h3>
        <p>In dark mode the eyes turn black. Without <code>theme</code>, Mochi follows the page.</p>
      </article>

      <article v-reveal="1" class="carte-b b-acc">
        <div class="b-image">
          <AccDefile />
        </div>
        <h3>{{ N_ACC }} accessories</h3>
        <p>{{ N_EMPL }} slots ({{ NOMS_EMPL }}), one piece per slot, in your colours.</p>
      </article>

      <article v-reveal="2" class="carte-b b-pur">
        <pre class="b-code"><span class="c-mot">const</span> frame = engine.<span class="c-attr">sample</span>(t)</pre>
        <h3>A pure function of time</h3>
        <p>The engine has no clock: the same <code>t</code> always gives the same frame. Freeze one with <code>frozen-at</code>.</p>
      </article>

      <article v-reveal="3" class="carte-b b-leger">
        <div class="b-gros">0</div>
        <h3>Animation libraries</h3>
        <p>Everything is drawn in code. Three.js only loads when a 3D Mochi is on screen.</p>
      </article>

      <article v-reveal="4" class="carte-b b-export">
        <div class="b-formats"><span>SVG</span><span>PNG</span><span>GIF</span><span>MP4</span></div>
        <h3>Exports</h3>
        <p>Save a frame or a whole loop from the <a href="/app">app</a>.</p>
      </article>
    </div>
    <div class="wrap bande-wrap">
      <BandePieces />
    </div>
  </section>
</template>
