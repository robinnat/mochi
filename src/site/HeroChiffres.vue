<script setup lang="ts">
import { CHIFFRES } from './catalog'
</script>

<template>
  <ul class="chiffres wrap" aria-label="Mochi in numbers">
    <li v-for="(c, i) in CHIFFRES" :key="c.label" v-reveal="i">
      <strong>{{ c.valeur }}</strong><span>{{ c.label }}</span>
    </li>
  </ul>
</template>
