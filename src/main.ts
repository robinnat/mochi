import { mountApp } from '@/ui/dom/h'
import { followLanguageDocument } from '@/i18n'
import { App } from './App'
import { currentTheme } from '@/ui/3d/currentTheme'
import './styles.css'

// only the app follows its language on the page (`lang` attribute, tab title)
followLanguageDocument()
// the app's interface is light only: its Mochis stay light even when the device is in dark mode
currentTheme.value = 'light'
mountApp(App, '#app')
