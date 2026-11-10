# Getting started

Mochis are small animated characters. This project gives you one HTML tag, `<mochi-bot>`, that draws a Mochi in real 3D. It works in plain HTML and in any framework (React, Vue, Svelte, Angular...).

On the website, every example marked "Live" is rendered right below its code: what you see is what the code produces.

## Install

> The npm package is coming soon. `mochis` is not published yet, so `npm install mochis` does not work today. Until then, build it from the repository.

You need [Node.js](https://nodejs.org) 20 or later. Build the library once:

```bash
# 1. Get the source and build the library
git clone https://github.com/robinnat/mochi.git
cd mochi
npx pnpm@11.17.0 install
npx pnpm@11.17.0 build:lib

# 2. Copy the built files into your project (keep them together:
#    the 3D part and Three.js are separate files, loaded on demand)
cp -r dist-lib ../my-app/public/mochi
```

Then load it once per page. Loading the file declares the `<mochi-bot>` tag:

```html
<!-- plain HTML -->
<script type="module" src="/mochi/mochis.js"></script>
```

```js
// or, in an app with a bundler (React, Svelte, Angular...)
import '/mochi/mochis.js'
```

Your app needs nothing else: Three.js (the 3D library) is a separate file that only loads when a Mochi is shown. The built files keep the MIT license notice: ship it with your app.

## Your first Mochi

```html live
<script type="module" src="/mochi/mochis.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

That is a breathing, blinking 3D star. It waves when it appears and reacts when you touch it.

Every option is both:

- an **attribute**, written in HTML as text (`size="200"`);
- a **property**, set in JavaScript with any value (`bot.size = 200`).

Attribute names use dashes (`frozen-at`), property names use camelCase (`frozenAt`). The [reference](reference.md) lists them all.

## Shapes and colors

`shape` takes one of the 12 shape ids. `color` takes a color id, or any hex color.

```html live
<!-- a color id from the catalog -->
<mochi-bot shape="cloud" color="pink"></mochi-bot>

<!-- or any hex color, long or short -->
<mochi-bot shape="heart" color="#ff8800"></mochi-bot>
<mochi-bot shape="squircle" color="#f80"></mochi-bot>
```

All the ids are in the reference: [shapes](reference.md#shapes) and [colors](reference.md#colors).

## Styles

There are three styles, all in real 3D. The model is the same, only the drawing changes.

| Id | Style |
| --- | --- |
| `3d` | Soft (the default) |
| `pixel3d` | Pixel |
| `flat3d` | Flat |

```html live
<!-- Soft is the default -->
<mochi-bot render-style="3d"></mochi-bot>

<!-- Pixel: pixel sizes large, medium or fine (the default) -->
<mochi-bot render-style="pixel3d" pixel="medium"></mochi-bot>

<!-- Flat, with a cartoon outline twice as thick -->
<mochi-bot render-style="flat3d" outline outline-width="2"></mochi-bot>

<!-- turn the model: an angle in radians around the vertical axis -->
<mochi-bot yaw="0.5"></mochi-bot>

<!-- no highlight, no ground shadow, no body shading -->
<mochi-bot highlight="false" shadow="false" shading="false"></mochi-bot>
```

Mochi is always drawn in 3D. Without WebGL (the browser feature that draws 3D), a short message takes its place and the element fires a `no3d` event.

## Moods

A mood changes the face and the way the body moves. It loops until you change it, and the change glides.

```html live
<mochi-bot mood="working" shape="squircle"></mochi-bot>

<!-- working shows a small 3D laptop: hide it -->
<mochi-bot mood="working" laptop="false"></mochi-bot>
```

To change the mood from your code, set the attribute again:

```html
<mochi-bot id="bot" mood="working"></mochi-bot>
<button onclick="bot.setAttribute('mood', 'done')">Done</button>
```

The seven moods are listed in the [reference](reference.md#moods).

## Accessories

A Mochi can wear one accessory per slot, and all slots stack. The slots are `head`, `eyes`, `neck` and `back`.

- Give the accessory id alone to use its catalog colors.
- Or give an object with your own colors: `c1` is the main color, `c2` the second one (for two-color pieces).

As an attribute, write it in JSON:

```html live
<mochi-bot accessories='{"head": "cap", "eyes": "round"}'></mochi-bot>
```

As a property, write a normal JavaScript object:

```js
document.querySelector('mochi-bot').accessories = {
  head: { id: 'flower', c1: '#ff4d94', c2: '#ffd60a' },
  neck: { id: 'scarf', c1: '#2d5bff' },
  back: 'cape'
}
```

Every accessory id is in the [reference](reference.md#accessories).

## Light and dark

In the dark theme the eyes turn black. The body is lightened only when it would not contrast enough with them.

```html live
<!-- one Mochi -->
<mochi-bot theme="dark"></mochi-bot>
```

```js
// or every Mochi that has no theme of its own, at once
import { currentTheme } from '/mochi/mochis.js'
currentTheme.value = 'dark'
```

## Reactions

With `interactions` on (the default), a Mochi reacts by itself:

| Gesture | Reaction |
| --- | --- |
| Hover | the eyes follow the pointer |
| Tap | `startle` |
| Double tap | `laugh` |
| Long press | `blush`, held while you press |
| Shake or fast spin | `dizzy` |

You can also drive it from your code. The methods are on the element:

```html
<mochi-bot id="bot" mood="idle"></mochi-bot>
<button id="celebrate">Celebrate</button>

<script type="module">
  const bot = document.getElementById('bot')
  document.getElementById('celebrate').addEventListener('click', () => {
    bot.setMood('done') // glide to another mood
    bot.react('laugh') // play a reaction, then go back to the mood
  })
  bot.lookAt({ nx: 1, ny: -1 }) // from -1 to 1, right and down are positive
</script>
```

## Still images and performance

```html live
<!-- a still image: no animation loop, the same picture every time -->
<mochi-bot mood="done" frozen-at="1.2" size="96"></mochi-bot>

<!-- a live Mochi capped at 12 frames per second -->
<mochi-bot mood="idle" fps="12"></mochi-bot>

<!-- no reactions to the pointer -->
<mochi-bot interactions="false"></mochi-bot>
```

- `frozen-at` draws one exact instant (in seconds) without any animation loop: good for lists and thumbnails.
- All 3D Mochis on a page share one WebGL context.
- The `ready` event fires when the first 3D frame is painted. Until then you can show your own image.
- When a Mochi is removed from the page, it stops its loop and its listeners.

```html
<mochi-bot id="live" mood="idle" max-pixel-ratio="1.5"></mochi-bot>
<script type="module">
  document.getElementById('live').addEventListener('ready', () => console.log('first frame painted'))
</script>
```

## In a framework

`<mochi-bot>` is a standard custom element: write it like any HTML tag. Text options go in attributes. Objects (`accessories`, `cycle`) can also be set as properties.

```jsx
// React 19
import '/mochi/mochis.js'

export function Avatar({ mood }) {
  return <mochi-bot shape="star" color="#2d5bff" mood={mood} size="160" onready={() => console.log('ready')} />
}
```

```svelte
<!-- Svelte -->
<script>
  import '/mochi/mochis.js'
  let mood = $state('idle')
</script>

<mochi-bot shape="cloud" color="pink" {mood} size="160"></mochi-bot>
<button onclick={() => (mood = 'done')}>Done</button>
```

```vue
<!-- Vue: tell Vue that mochi-bot is a custom element (compilerOptions.isCustomElement) -->
<script setup>
import '/mochi/mochis.js'
</script>

<template>
  <mochi-bot shape="egg" color="green" mood="idle" size="160"></mochi-bot>
</template>
```

Next: the [reference](reference.md) lists every option, method, event and id.
