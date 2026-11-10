import { mountApp } from '@/ui/dom/h'
import { currentTheme } from 'mochis/catalog'
import { Lab } from './Lab'
import '@/styles.css'

// the lab page is light: its sheets compare Mochis on a light background, whatever the device's theme
currentTheme.value = 'light'
mountApp(Lab, '#lab')
