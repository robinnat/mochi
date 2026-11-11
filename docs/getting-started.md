# Getting started

Mochis are small animated characters for the web. One character is called a Mochi. This project gives you one HTML tag, `<mochi-bot>`, that draws a Mochi in real 3D.

`<mochi-bot>` is a **web component**: an HTML tag defined in JavaScript, that every modern browser understands. So it works in plain HTML and in any framework (React, Vue, Svelte, Angular...).

On the website, every example marked "Live" shows its result right below the code: what you see is what the code produces.

## Install

### With npm (recommended)

You need [Node.js](https://nodejs.org) 22.12 or later. Install Mochis and Three.js (the 3D library Mochis draws with):

```bash
npm install mochis three
```

Three.js is a peer dependency: your project installs it once, and Mochis uses that copy. Then import the library once, from a file of your app (here `src/main.js`). Importing it declares the `<mochi-bot>` tag:

```js
import 'mochis'
```

That is all. TypeScript types come with the package: `document.querySelector('mochi-bot')` is typed, and so are the catalogs. If your `tsconfig.json` sets `skipLibCheck` to `false`, also install the Three.js types: `npm install -D @types/three`. The 3D part loads by itself, only when a Mochi is shown.

To build a picker without loading the tag, import the catalogs alone:

```js
import { SHAPES, COLORS } from 'mochis/catalog'
```

### Plain HTML, without a build tool

Load the standalone build (Three.js included) from a CDN, with a script tag:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/mochis@0.2.0/dist-lib/standalone/mochis.js"></script>
```

### Without npm: build it from the repository

You can also build the library yourself and copy it into your project:

```bash
git clone https://github.com/robinnat/mochi.git
cd mochi
npx pnpm@11.17.0 install
npx pnpm@11.17.0 build:lib
```

This writes the library to `dist-lib/`. Copy the `dist-lib/standalone` folder (Three.js included), and keep its files together: the 3D part is a separate file, loaded only when a Mochi is shown.

- Plain HTML: copy it next to your page, under the name `mochis` (`cp -r dist-lib/standalone ../my-site/mochis`), then load it with `<script type="module" src="/mochis/mochis.js"></script>`.
- An app with a bundler (Vite, webpack...): copy it into your source code (`cp -r dist-lib/standalone ../my-app/src/vendor/mochis`), then write `import './vendor/mochis/mochis.js'` in a file of `src/`. Do not put it in `public/`: a bundler serves that folder as is and cannot import JavaScript from it.

The built files keep the MIT license notice: ship it with your app.

The examples below load the library from the CDN in plain HTML and with `import 'mochis'` in JavaScript. Use the way that matches your project.

## Your first Mochi

```html live
<script type="module" src="https://cdn.jsdelivr.net/npm/mochis@0.2.0/dist-lib/standalone/mochis.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

That is a 3D star that breathes and blinks. It waves when it appears, and it reacts when you touch it.

## Options

You set up a Mochi with options. Each option can be written in two ways:

- as an **attribute**, in HTML, always as text: `size="200"`;
- as a **property**, in JavaScript, with any value: `bot.size = 200`.

Attribute names use dashes (`frozen-at`). Property names use camelCase: no dash, and a capital letter for each new word (`frozenAt`).

A yes-or-no option is on when the attribute is present (`wave`), and off with `"false"` (`shadow="false"`).

### Size, shape and color

- `size` is the width and height, in pixels (320 by default).
- `shape` takes one of the 12 shape ids.
- `color` takes one of the 18 color ids, or any hex color. A hex color is `#` followed by 6 or 3 digits from 0 to f, like `#ff8800` or `#f80`.

```html live
<!-- a color id from the catalog -->
<mochi-bot shape="cloud" color="pink" size="120"></mochi-bot>

<!-- or any hex color, long or short -->
<mochi-bot shape="heart" color="#ff8800" size="120"></mochi-bot>
<mochi-bot shape="squircle" color="#f80" size="120"></mochi-bot>
```

All the ids are in the reference: [shapes](reference.md#shapes) and [colors](reference.md#colors).

## Moods

A mood changes the face and the way the body moves. It plays on a loop until you change it, and the change is smooth.

```html live
<mochi-bot mood="working" shape="squircle"></mochi-bot>

<!-- working shows a small 3D laptop: hide it -->
<mochi-bot mood="working" laptop="false"></mochi-bot>
```

There are seven moods: `idle`, `thinking`, `working`, `waiting`, `done`, `blocked` and `asleep`. The [reference](reference.md#moods) describes each one.

## Reactions

A reaction is a short move played once, on top of the mood. With `interactions` on (the default), a Mochi reacts by itself:

| Gesture | Reaction |
| --- | --- |
| Hover | the eyes follow the pointer |
| Tap | `startle` |
| Double tap | `laugh` |
| Long press | `blush`, held while you press |
| Shake or fast spin | `dizzy` |

```html live
<!-- no reactions to the pointer -->
<mochi-bot interactions="false"></mochi-bot>
```

## Methods

A method is a function you call on the element, from JavaScript. Use methods to drive a Mochi from your code:

- `setMood(id)` glides to another mood;
- `react(id)` plays a reaction, then goes back to the mood;
- `lookAt({ nx, ny })` aims the eyes. `nx` and `ny` go from -1 to 1: right and down are positive.

```html
<mochi-bot id="bot" mood="idle"></mochi-bot>
<button id="celebrate">Celebrate</button>

<script type="module">
  const bot = document.getElementById('bot')
  document.getElementById('celebrate').addEventListener('click', () => {
    bot.setMood('done') // glide to another mood
    bot.react('laugh') // play a reaction, then go back to the mood
  })
  bot.lookAt({ nx: 1, ny: -1 }) // look to the top right
</script>
```

Changing the attribute does the same as `setMood`:

```html
<mochi-bot id="bot" mood="working"></mochi-bot>
<button onclick="document.getElementById('bot').setAttribute('mood', 'done')">Done</button>
```

The [reference](reference.md#methods) lists every method.

## Events

An event is a signal the element sends when something happens. You listen to it with `addEventListener`. The most useful one is `ready`: it fires when the first 3D frame is painted. Until then, you can show your own image.

```html
<mochi-bot id="live" mood="idle"></mochi-bot>
<script type="module">
  document.getElementById('live').addEventListener('ready', () => console.log('first frame painted'))
</script>
```

If the browser cannot draw 3D (it has no WebGL, the browser feature that draws 3D), a short message replaces the Mochi and the element fires `no3d` instead. The [reference](reference.md#events) lists every event.

## Accessories

A Mochi can wear accessories in four places, called slots: `head`, `eyes`, `neck` and `back`. It wears at most one accessory per slot, and you can fill all four at once.

- Give the accessory id alone to use its catalog colors.
- Or give an object with your own colors: `c1` is the main color, `c2` the second one (only for two-color pieces, like the flower).

As an attribute, write it in JSON (the text format for JavaScript objects, with double quotes around every name and text):

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

<!-- Pixel, with medium pixels (medium or fine; fine is the default) -->
<mochi-bot render-style="pixel3d" pixel="medium"></mochi-bot>

<!-- Flat: two or three flat tones -->
<mochi-bot render-style="flat3d"></mochi-bot>
```

A few more options change the look in every style:

```html live
<!-- turn the model: an angle in radians (a full turn is about 6.28) -->
<mochi-bot yaw="0.5"></mochi-bot>

<!-- no ground shadow, no body shading (one flat color) -->
<mochi-bot shadow="false" shading="false"></mochi-bot>
```

## Light and dark

By default, a Mochi follows the visitor's device: light when the system is in light mode, dark when it is in dark mode. It switches by itself when the visitor changes the setting. In the dark theme the eyes turn black, and the body gets a little lighter only when it would not contrast enough with them.

To choose the theme yourself, set it on one Mochi:

```html live
<mochi-bot theme="dark"></mochi-bot>
```

Or set it for every Mochi of the page that has no `theme` of its own, for example when your site has its own light and dark switch:

```js
import { currentTheme } from 'mochis'

currentTheme.value = 'dark' // 'light', 'dark', or 'auto' to follow the device again (the default)
```

## Still images and speed

```html live
<!-- a still image: no animation loop, the same picture every time -->
<mochi-bot mood="done" frozen-at="1.2" size="96"></mochi-bot>

<!-- a live Mochi capped at 12 frames per second -->
<mochi-bot mood="idle" fps="12"></mochi-bot>
```

- `frozen-at` draws one exact instant (a time in seconds) without any animation loop. Use it for lists and thumbnails.
- `fps` caps the number of frames per second: lighter when many Mochis move at once.
- `max-pixel-ratio` caps the sharpness of the 3D canvas (2 by default). `1.5` is lighter on phones.
- All the Mochis of a page share one WebGL context (one 3D drawing surface), so a page can show many of them. Each Mochi still keeps its own body, face and accessories, so one Mochi never redoes the work of another.
- A Mochi off the screen (scrolled away or in a hidden panel) draws nothing. Its clock keeps going, and it is up to date as soon as it comes back into view.
- When drawing every Mochi at every frame gets too heavy (a slow phone, many Mochis on screen), each one draws every other frame by itself: 30 frames per second, steady, and the page keeps its own speed. A Mochi with its own `fps` keeps it.
- When a Mochi is removed from the page, it stops its animation loop and its listeners by itself.

```html
<mochi-bot mood="idle" max-pixel-ratio="1.5"></mochi-bot>
```

## In a framework

`<mochi-bot>` is a standard HTML tag: write it like any other. Text options go in attributes. Objects (`accessories`, `cycle`) can also be set as properties.

```jsx
// React 19
import 'mochis'

export function Avatar({ mood }) {
  return <mochi-bot shape="star" color="#2d5bff" mood={mood} size="160" onready={() => console.log('ready')} />
}
```

```svelte
<!-- Svelte 5 -->
<script>
  import 'mochis'
  let mood = $state('idle')
</script>

<mochi-bot shape="cloud" color="pink" {mood} size="160"></mochi-bot>
<button onclick={() => (mood = 'done')}>Done</button>
```

```vue
<!-- Vue: tell Vue that mochi-bot is a custom element (compilerOptions.isCustomElement) -->
<script setup>
import 'mochis'
</script>

<template>
  <mochi-bot shape="egg" color="green" mood="idle" size="160"></mochi-bot>
</template>
```

Next: the [reference](reference.md) lists every option, method, event and id.
