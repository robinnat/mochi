import { createApp } from 'vue'
import Site from './Site.vue'
import { vReveal } from './motion'
import './site.css'

createApp(Site).directive('reveal', vReveal).mount('#site')
// le moteur d'interface de l'application regle `lang` sur la langue du navigateur : ici, le site est en anglais
document.documentElement.lang = 'en'
