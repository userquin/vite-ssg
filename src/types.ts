import { App } from 'vue'
import { RouteLocationRaw, Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { I18n } from 'vue-i18n'
import { HeadAttrs, HeadClient, HeadObject } from '@vueuse/head'

export type Crawling = {
  // https://developers.google.com/search/docs/advanced/crawling/special-tags
  noTranslate?: HeadAttrs
  // localized versions of your page
  // https://developers.google.com/search/docs/advanced/crawling/localized-versions
  localizedVersions?: Record<string, HeadAttrs>
  /**
   * Extract head entries.
   */
  extractAlternateUrls?: () => HeadAttrs[]
}

export type ViteSSGLocale = {
  locale: string
  description: string
  lang: string
  country?: string
  variant?: string
  to: RouteLocationRaw
}

export type LocaleInfo = {
  current: string
  locales: Record<string, ViteSSGLocale>
}

// @ts-ignore
export type CreateVueI18nFn = (
  messagesResolver: () => Record<string, any>,
  app: App,
  localeInfo?: LocaleInfo,
) => I18n<Record<string, any>, unknown, unknown, false>

export interface I18nOptions {
  /**
   * Default locale for the application.
   */
  defaultLocale: string
  /**
   * The path variable to match the locale.
   *
   * @default 'locale'
   */
  localePathVariable?: string
  /**
   * Locale and its description.
   *
   * The `locale description` should be in its own `locale`, for example:
   *
   * `'en-US': 'American English'` or `'es-ES': 'Español de España'`
   */
  locales?: Record<string, string> | undefined
}

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
   * `vue-i18n@next` entry: read the docs for multi-page, since you will need to change your `index.html` template.
   *
   * Including this entry will force `useHead` to `true`.
   */
  i18nOptions?: I18nOptions
}

type PartialKeys<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>

export interface ViteSSGContext<HasRouter extends boolean = true> {
  app: App<Element>
  router: HasRouter extends true ? Router : undefined
  routes: HasRouter extends true ? RouteRecordRaw[] : undefined
  initialState: Record<string, any>
  head: HeadClient | undefined
  isClient: boolean
  localeInfo: LocaleInfo | undefined
  // @ts-ignore
  createI18n?: CreateVueI18nFn
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

// extend vue-router meta
declare module 'vue-router' {
  interface RouteMeta {
    /**
     * The locale for the route.
     */
    locale?: ViteSSGLocale
    /**
     * Inject the following objects to `HeadObject` (to be used with `useHead`):
     *
     * 1) Meta tag for `og:locale` for the current locale:
     * ```html
     * <meta property="og:locale" content="en">
     * ```
     * 2) Meta tag to avoid browser showing page translation popup:
     * ```html
     * <meta name="google" content="notranslate">
     * ```
     * 3) `link`s for alternate urls for each locale, for example ( `en` is the default locale ):
     * ```html
     * <link rel="alternate" hreflang="x-default" href="http://localhost:3000/route">
     * <link rel="alternate" hreflang="es" href="http://localhost:3000/es/route">
     * ```
     *
     * @param head The head object
     * @param locale The current locale (`route.params.locale` or `createI18n.global.value` )
     */
    injectI18nMeta?: (head: HeadObject) => HeadObject
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
