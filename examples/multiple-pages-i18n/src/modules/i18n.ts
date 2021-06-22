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
    async(locale, to) => {
      try {
        const messagesModule = await import(/* @vite-ignore */ `../pages/${to.meta.rawI18nPath}.json5`)
        // const messagesModule = await import(/* @vite-ignore */ `../../locales/pages/${to.meta.rawI18nPath}.json5`)
        // should use default
        return messagesModule.default || messagesModule
      }
      catch (e) {
        console.error('uppps', e)
        return undefined
      }
    },
    (route, headObject, pageMessages) => {
      const meta = route.meta
      if (meta && meta.injectI18nMeta) {
        if (pageMessages) {
          const key = `/${meta.rawI18nPath}`
          if (pageMessages.te(`${key}.title`))
            meta.title = pageMessages.t(`${key}.title`)
          if (pageMessages.te(`${key}.description`))
            meta.description = pageMessages.t(`${key}.description`)
        }
        meta.injectI18nMeta(headObject, route)
      }
    },
  )
}
