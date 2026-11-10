import { monterApp } from '@/ui/dom/h'
import { suivreLangueDocument } from '@/i18n'
import { App } from './App'
import './styles.css'

// seule l'application suit sa langue sur la page (attribut `lang`, titre de l'onglet)
suivreLangueDocument()
monterApp(App, '#app')
