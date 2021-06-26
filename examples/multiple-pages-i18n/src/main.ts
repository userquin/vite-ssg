import routes from 'virtual:generated-pages'
import { ViteSSG, I18nOptions } from 'vite-ssg/i18n'
import { locales, defaultLocale, defaultLocaleOnUrl } from '../ssg-i18n-options.json'
import App from './App.vue'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const i18nMessages: any = Object.fromEntries(Object.entries(import.meta.globEager('../../locales/*.yml'))
  .map(([key, value]) => [key.slice(14, -4), value.default]),
)

const i18nOptions: I18nOptions = {
  locales,
  defaultLocale,
  defaultLocaleOnUrl,
  async globalMessages() {
    return i18nMessages as Record<string, any>
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
}

export const createApp = ViteSSG(
  App,
  { routes },
  { i18nOptions },
)
