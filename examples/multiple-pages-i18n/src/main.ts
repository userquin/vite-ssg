import routes from 'virtual:generated-pages'
import { ViteSSG } from 'vite-ssg/i18n'
import { locales, defaultLocale, defaultLocaleOnUrl } from '../ssg-i18n-options.json'
import App from './App.vue'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const i18nMessages = Object.fromEntries(Object.entries(import.meta.globEager('../locales/*.yml'))
  .map(([key, value]) => [key.slice(11, -4), value.default]),
)

export const createApp = ViteSSG(
  App,
  { routes },
  {
    i18nOptions: {
      locales,
      defaultLocale,
      defaultLocaleOnUrl,
      globalMessages() {
        return i18nMessages
      },
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
      async headConfigurer(route, headObject, i18nComposer, locale) {
        const meta = route.meta
        if (meta && meta.injectI18nMeta) {
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
    },
  },
)
