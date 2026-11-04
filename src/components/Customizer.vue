<script setup lang="ts">
import BotTile from '@/components/BotTile.vue'
import { EXPRESSIONS } from '@/bot/expressions'
import { COLORS, SHAPES } from '@/bot/skins'
import { t } from '@/i18n'
import { RENDUS, TAILLES_PIXEL, type RenduId, type TaillePixelId } from '@/ui/rendu'

const shape = defineModel<string>('shape', { required: true })
const color = defineModel<string>('color', { required: true })
const expression = defineModel<string>('expression', { required: true })
const rendu = defineModel<RenduId>('rendu', { required: true })
const pixel = defineModel<TaillePixelId>('pixel', { required: true })
const contour = defineModel<boolean>('contour', { default: false })

/**
 * Les vignettes sont figees a la meme date que la pose de repos : elles montrent
 * la forme et le visage tels qu'ils apparaitront, pas un aplat abstrait.
 */
const PREVIEW_AT = 1
</script>

<template>
  <div>
    <!--
      Le style en premier : c'est le choix qui change le plus l'avatar. Chaque vignette
      montre le bot dans SON style, les autres grilles suivent le style retenu.
    -->
    <h2 class="text-sm font-semibold">{{ t('panel.style') }}</h2>
    <div class="mt-2 grid grid-cols-3 gap-1.5">
      <BotTile
        v-for="r in RENDUS"
        :key="r"
        :label="t(`styles.${r}`)"
        :selected="r === rendu"
        :shape="shape"
        :color="color"
        :expression="expression"
        :rendu="r"
        :pixel="pixel"
        :frozen-at="PREVIEW_AT"
        @click="rendu = r"
      />
    </div>

    <!-- la taille des pixels n'a de sens qu'en style Pixel -->
    <div v-if="rendu === 'pixel3d'" class="mt-3">
      <h3 id="taille-pixels" class="text-xs text-[var(--muted)]">{{ t('panel.pixelSize') }}</h3>
      <div class="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-labelledby="taille-pixels">
        <button
          v-for="p in TAILLES_PIXEL"
          :key="p.id"
          type="button"
          class="cursor-pointer rounded-lg border-2 px-2 py-1 text-xs transition"
          :class="
            p.id === pixel
              ? 'border-[var(--ink)]'
              : 'border-transparent bg-black/5 hover:border-[var(--line)]'
          "
          :aria-pressed="p.id === pixel"
          @click="pixel = p.id"
        >
          {{ t(`pixelSizes.${p.id}`) }}
        </button>
      </div>
    </div>

    <!-- le contour cartoon : style Flat -->
    <label v-if="rendu === 'flat3d'" class="mt-3 flex cursor-pointer items-center gap-2 text-xs">
      <input v-model="contour" type="checkbox" class="size-4 cursor-pointer accent-[var(--ink)]" />
      {{ t('panel.contour') }}
    </label>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.shape') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="s in SHAPES"
        :key="s.id"
        :label="t(`shapes.${s.id}`)"
        :selected="s.id === shape"
        :shape="s.id"
        :color="color"
        :expression="expression"
        :frozen-at="PREVIEW_AT"
        @click="shape = s.id"
      />
    </div>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.expression') }}</h2>
    <div class="mt-2 grid grid-cols-4 gap-1.5">
      <BotTile
        v-for="e in EXPRESSIONS"
        :key="e.id"
        :label="t(`expressions.${e.id}`)"
        :selected="e.id === expression"
        :shape="shape"
        :color="color"
        :expression="e.id"
        :frozen-at="PREVIEW_AT"
        @click="expression = e.id"
      />
    </div>

    <h2 class="mt-5 text-sm font-semibold">{{ t('panel.color') }}</h2>
    <div class="mt-2 grid grid-cols-6 gap-1.5">
      <button
        v-for="c in COLORS"
        :key="c.id"
        type="button"
        class="flex aspect-square cursor-pointer items-center justify-center rounded-full border-2 transition"
        :class="
          c.id === color ? 'border-[var(--ink)]' : 'border-transparent hover:border-[var(--line)]'
        "
        :aria-label="t(`colors.${c.id}`)"
        :aria-pressed="c.id === color"
        @click="color = c.id"
      >
        <!-- liseré interne : sinon la pastille creme disparait sur fond clair -->
        <span
          class="block h-[78%] w-[78%] rounded-full ring-1 ring-black/10 ring-inset"
          :style="{ background: c.hex }"
        />
      </button>
    </div>
  </div>
</template>
