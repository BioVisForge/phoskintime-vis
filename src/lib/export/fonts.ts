/** The bundled UI/export font "PKV Sans" (OFL; see THIRD_PARTY.md), inlined as data URLs. */
import regular from '../../assets/fonts/PKVSans-Regular.ttf?inline'
import bold from '../../assets/fonts/PKVSans-Bold.ttf?inline'

export const FONT_FAMILY = 'PKV Sans'
export const fontDataUrl = { regular, bold }
export const fontBase64 = {
  regular: regular.slice(regular.indexOf(',') + 1),
  bold: bold.slice(bold.indexOf(',') + 1),
}

export function fontFaceCss(): string {
  return (
    `@font-face{font-family:'${FONT_FAMILY}';font-weight:400;src:url(${regular}) format('truetype');}` +
    `@font-face{font-family:'${FONT_FAMILY}';font-weight:700;src:url(${bold}) format('truetype');}`
  )
}
