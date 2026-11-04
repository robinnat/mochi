import { createApp, h } from 'vue'
import MochiBot from '../src/components/MochiBot.vue'

// deux mochis fixes : une boule violette et une etoile rose, en argile, a une date precise
createApp({
  render: () => [
    h('div', { style: 'position:absolute; left:610px; top:70px' }, [
      h(MochiBot, { size: 430, shape: 'cercle', color: 'violet', rendu: 'argile', frozenAt: 1, label: '' })
    ]),
    h('div', { style: 'position:absolute; left:930px; top:290px' }, [
      h(MochiBot, { size: 270, shape: 'etoile', color: 'rose', rendu: 'argile', frozenAt: 1.2, label: '' })
    ])
  ]
}).mount('#og')
