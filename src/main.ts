import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { fontFaceCss } from './lib/export/fonts'

// bundled UI/export font (no network)
const style = document.createElement('style')
style.textContent = fontFaceCss()
document.head.appendChild(style)

export default mount(App, { target: document.getElementById('app')! })
