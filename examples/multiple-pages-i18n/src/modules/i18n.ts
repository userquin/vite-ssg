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
    async(route, headObject, i18nComposer, locale) => {
      const meta = route.meta
      if (meta && meta.injectI18nMeta) {
        if (!meta.isGlobal)
          console.log(i18nComposer.messages.value[locale.locale].title)

        // you can delegate to default behavior
        headObject.value = meta.injectI18nMeta(
          headObject.value,
          locale,
          i18nComposer,
        )
        // you can customize the entire head object
        /*
        const routeName = route.name?.toString() || route.path
        // we can add what we want, also change the entire headObject
        meta.injectI18nMeta(
          headObject.value,
          locale,
          i18nComposer,
          i18nComposer.t(`page-${routeName}.title`),
          i18nComposer.t(`page-${routeName}.description`),
        )
        */
        // or you can change the entire head object page
        // todo@userquin: include example with dynamic import
        // headObject = await import()
      }

      return true
    },
  )
}
