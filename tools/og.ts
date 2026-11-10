import { h, render } from '../src/ui/dom/h'
import 'mochis'

// deux mochis fixes : une boule bleu ciel et une etoile orange (P1, 09/11/2026), en 3D Soft, a une date precise
render(
  h('div', { style: 'display: contents' }, [
    h('div', { style: 'position:absolute; left:610px; top:70px' }, [
      h('mochi-bot', { size: 430, shape: 'circle', color: '#21b0ff', renderStyle: '3d', frozenAt: 1, label: '' })
    ]),
    h('div', { style: 'position:absolute; left:930px; top:290px' }, [
      h('mochi-bot', { size: 270, shape: 'star', color: '#ff9500', renderStyle: '3d', frozenAt: 1.2, label: '' })
    ])
  ]),
  document.getElementById('og')!
)
