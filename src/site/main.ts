import { createApp } from 'vue'
import Site from './Site.vue'
import './site.css'

createApp(Site).mount('#site')
// le moteur d'interface de l'application regle `lang` sur la langue du navigateur : ici, le site est en anglais
document.documentElement.lang = 'en'
