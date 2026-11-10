import { h, rendre } from '../src/ui/dom/h'
import '../src/components/mochi-bot'

// deux mochis fixes : une boule bleu ciel et une etoile orange (P1, 09/11/2026), en argile, a une date precise
rendre(
  h('div', { style: 'display: contents' }, [
    h('div', { style: 'position:absolute; left:610px; top:70px' }, [
      h('mochi-bot', { size: 430, shape: 'cercle', color: '#21b0ff', rendu: 'argile', frozenAt: 1, label: '' })
    ]),
    h('div', { style: 'position:absolute; left:930px; top:290px' }, [
      h('mochi-bot', { size: 270, shape: 'etoile', color: '#ff9500', rendu: 'argile', frozenAt: 1.2, label: '' })
    ])
  ]),
  document.getElementById('og')!
)
