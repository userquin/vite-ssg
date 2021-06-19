import { ViteSSG, ViteSSGContext } from 'vite-ssg'
import routes from 'virtual:generated-pages'
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  { routes },
  (ctx: ViteSSGContext) => {
    Object.values(import.meta.globEager('./modules/*.ts')).map(i => i.install?.(ctx))
  },
  {
    i18nOptions: {
      defaultLocale: 'en',
      locales: {
        en: 'English',
        es: 'Español',
      },
    },
  },
)
