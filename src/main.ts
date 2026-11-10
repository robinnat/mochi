import { mountApp } from '@/ui/dom/h'
import { followLanguageDocument } from '@/i18n'
import { App } from './App'
import './styles.css'

// only the app follows its language on the page (`lang` attribute, tab title)
followLanguageDocument()
mountApp(App, '#app')
