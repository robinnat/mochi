import { createApp } from 'vue'
import Docs from './Docs.vue'
import { vReveal } from '@/site/motion'
import '@/site/site.css'

createApp(Docs).directive('reveal', vReveal).mount('#site')
// le moteur d'interface de l'application regle `lang` sur la langue du navigateur : ici, la page est en anglais
document.documentElement.lang = 'en'
