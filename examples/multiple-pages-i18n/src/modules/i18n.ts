import { ViteSSGContext } from 'vite-ssg'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const globalMessages: any = Object.fromEntries(Object.entries(import.meta.globEager('../../locales/*.yml'))
  .map(([key, value]) => [key.slice(14, -4), value.default]),
)

export const install = (ctx: ViteSSGContext) => {
  ctx.createI18n?.(
    ctx,
    globalMessages,
    undefined,
    // async(locale, to) => {
    //   try {
    //     const messagesModule = await import(/* @vite-ignore */ `../pages/${to.meta.rawI18nPath}.json5`)
    //     // const messagesModule = await import(/* @vite-ignore */ `../../locales/pages/${to.meta.rawI18nPath}.json5`)
    //     // should use default
    //     return messagesModule.default || messagesModule
    //   }
    //   catch (e) {
    //     console.error('uppps', e)
    //     return undefined
    //   }
    // },
    async(route, headObject, pageMessages, locale) => {
      const meta = route.meta
      if (meta && meta.injectI18nMeta) {
        // we can add what we want, also change the entire headObject
        meta.injectI18nMeta(headObject.value, locale)
      }

      return true
    },
  )
}
