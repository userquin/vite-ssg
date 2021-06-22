import { App } from 'vue'
import { Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { HeadClient, HeadObject } from '@vueuse/head'
import { ViteSSGLocale, Crawling, I18nOptions, LocaleInfo, CreateVueI18n } from './i18n/types'
import { useAvailableLocales } from './i18n/composables'

export interface ViteSSGOptions {
  /**
   * Rewrite scripts loading mode, only works for `type="module"`
   *
   * @default 'sync'
   */
  script?: 'sync' | 'async' | 'defer' | 'async defer'

  /**
   * The path of main entry, relative to the project root
   *
   * @default 'src/main.ts'
   */
  entry?: string

  /**
   * Mock browser global variables (window, document, etc.) for SSG
   *
   * @default false
   */
  mock?: boolean

  /**
   * Applying formatter to the generated index file.
   *
   * @default null
   */
  formatting?: null | 'minify' | 'prettify'

  /**
   * Custom functions to modified the routes to do the SSG.
   *
   * Default to a handler that filter out all the dynamic routes,
   * when passing your custom handler, you should also take care the dynamic routes yourself.
   */
  includedRoutes?: (routes: string[]) => Promise<string[]> | string[]

  /**
   * Callback to be called before every page render.
   *
   * Also give the change to transform the index html passed to the renderer.
   */
  onBeforePageRender?: (route: string, indexHTML: string) => Promise<string | null | undefined> | string | null | undefined

  /**
   * Callback to be called on every page rendered.
   *
   * Also give the change to transform the rendered html by returning a string.
   */
  onPageRendered?: (route: string, renderedHTML: string) => Promise<string | null | undefined> | string | null | undefined

  onFinished?: () => void

  /**
   * `vue-i18n@next` entry: read the docs for multi-page, you will need to change your `index.html` template.
   */
  i18nOptions?: () => Promise<I18nOptions> | I18nOptions

}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export interface ViteSSGContext<HasRouter extends boolean = true> {
  app: App<Element>
  router: HasRouter extends true ? Router : undefined
  routes: HasRouter extends true ? RouteRecordRaw[] : undefined
  initialState: Record<string, any>
  head: HeadClient | undefined
  isClient: boolean
  // @ts-ignore
  createI18n?: CreateVueI18n
}

export interface ViteSSGClientOptions {
  transformState?: (state: any) => any
  registerComponents?: boolean
  useHead?: boolean
  rootContainer?: string | Element
  /**
   * `vue-i18n@next` entry: read the docs for multi-page, since you will need to change your `index.html` template.
   *
   * Including this entry will force `useHead` to `true`.
   */
  i18nOptions?: I18nOptions
}

export type RouterOptions = PartialKeys<VueRouterOptions, 'history'> & { base?: string }

export { ViteSSGLocale, Crawling, I18nOptions, LocaleInfo, CreateVueI18n, useAvailableLocales }

// extend vue-router meta
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
    /**
     * The original `path` without the `locale` prefix.
     */
    rawPath?: string
    /**
     * The original `path` without the `locale` prefix: for `/` will be `index`.
     */
    rawI18nPath?: string
    /**
     * The locale for the route.
     */
    locale?: ViteSSGLocale
    /**
     * Inject the following objects to `HeadObject`.
     *
     * 1) `lang` attribute for `html` element:
     * ```html
     * <html lang="en">
     * ```
     * 2) `title` head element from `route.meta.title`:
     * ```html
     * <title>TITLE</title>
     * ```
     * 3) `description` meta head from `route.meta.description`:
     * ```html
     * <meta name="description" content="<DESCRIPTION>">
     * ```
     * 4) Meta tag for `og:locale` for the current locale:
     * ```html
     * <meta property="og:locale" content="en">
     * ```
     * 5) Meta tag to avoid browser showing page translation popup:
     * ```html
     * <meta name="google" content="notranslate">
     * ```
     * 6) `link`s for alternate urls for each locale, for example ( `en` is the default locale ):
     * ```html
     * <link rel="alternate" hreflang="x-default" href="http://localhost:3000/route">
     * <link rel="alternate" hreflang="es" href="http://localhost:3000/es/route">
     * ```
     *
     * @param head The head object
     * @param locale The current locale
     */
    injectI18nMeta?: (head: HeadObject, locale: ViteSSGLocale) => HeadObject
    /**
     * Meta tags for alternative URLs.
     */
    crawling?: Crawling
  }
}

// extend vite.config.ts
declare module 'vite' {
  interface UserConfig {
    ssgOptions?: ViteSSGOptions
  }
}
