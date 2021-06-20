// import { createI18n } from 'vue-i18n'
import { ViteSSGContext } from 'vite-ssg'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const messages = Object.fromEntries(Object.entries(import.meta.globEager('../../locales/*.yml'))
  .map(([key, value]) => [key.slice(14, -4), value.default]),
)

export const install = (ctx: ViteSSGContext) => {
  ctx.createI18n?.(ctx, () => messages, '../../locales/')

  // const fallbackLocale = 'en'
  // const i18n = createI18n({
  //   legacy: false,
  //   fallbackLocale,
  //   locale: ctx.localeInfo?.current || fallbackLocale,
  //   messages,
  // })
  // ctx.localeRef = i18n.global.locale
  //
  // ctx.app.use(i18n)
}
