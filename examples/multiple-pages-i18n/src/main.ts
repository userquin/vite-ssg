import devalue from '@nuxt/devalue'
import routes from 'virtual:generated-pages'
import { ViteSSG } from 'vite-ssg/i18n'
import { createPinia } from 'pinia'
import { locales, defaultLocale, defaultLocaleOnUrl } from '../ssg-i18n-options.json'
import { useRootStore } from './store/root'
import App from './App.vue'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const globalMessages: Record<string, any> = Object.fromEntries(Object.entries(import.meta.globEager('../locales/*.yml'))
  .map(([key, value]) => [key.slice(11, -4), value.default]),
)

export const createApp = ViteSSG(
  App,
  { routes },
  {
    transformState(state) {
      return import.meta.env.SSR ? devalue(state) : state
    },
    i18nOptions: {
      locales,
      defaultLocale,
      defaultLocaleOnUrl,
      globalMessages,
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
  ({ app, router, initialState, i18n }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (import.meta.env.SSR) {
      // this will be stringified and set to window.__INITIAL_STATE__
      initialState.pinia = pinia.state.value
    }
    else {
      // on the client side, we restore the state
      pinia.state.value = initialState.pinia || {}
    }

    router.beforeEach((to, from, next) => {
      const store = useRootStore(pinia)

      store.initialize()
      next()
    })
  },
)
