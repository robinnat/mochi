import { mountApp } from '@/ui/dom/h'
import { currentTheme } from 'mochiz/catalog'
import { Lab } from './Lab'
import '@/styles.css'

// the lab page is light: its sheets compare Mochiz on a light background, whatever the device's theme
currentTheme.value = 'light'
mountApp(Lab, '#lab')
