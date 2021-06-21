import { ViteSSG, ViteSSGContext } from 'vite-ssg'
import routes from 'virtual:generated-pages'
import i18nOptions from '../ssg-i18n-options.json'
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  { routes },
  (ctx: ViteSSGContext) => {
    Object.values(import.meta.globEager('./modules/*.ts')).map(i => i.install?.(ctx))
  },
  {
    i18nOptions,
  },
)
