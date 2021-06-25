import { App, Ref } from 'vue'
import { Router, RouteRecordRaw, RouterOptions as VueRouterOptions } from 'vue-router'
import { HeadClient, HeadObject } from '@vueuse/head'
// @ts-ignore ignore when vue is not installed
import { Composer } from 'vue-i18n'
import { ViteSSGLocale, Crawling, I18nOptions, LocaleInfo, CreateVueI18n } from './i18n/types'
import { useAvailableLocales, useI18nRouter, injectHeadObject, useGlobalI18n } from './i18n/composables'

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
  requiresMapDefaultLocale?: boolean
  createI18n?: CreateVueI18n
  injectI18nSSG?: () => Promise<void>
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

export { ViteSSGLocale, Crawling, I18nOptions, LocaleInfo, CreateVueI18n, useAvailableLocales, useI18nRouter, injectHeadObject, useGlobalI18n }

// extend vue-router meta
declare module 'vue-router' {
  interface RouteMeta {
    /**
     * The key to localize the title and the description.
     *
     * The default value will be resolved from the `name` of the route or using the `path`.
     *
     * We suggest you using `route` from `vite-plugin-pages` on your page component:
     * <pre>
     * <route lang="yaml">
     * meta:
     *  pageI18nKey: 'PageA'
     * </route>
     * </pre>
     *
     * Beware on dynamic routes, we suggest you to include `pageI18nKey` using `route` from `vite-plugin-pages`.
     *
     * @default 'page-<route-name-or-route-path>'
     */
    pageI18nKey?: string
    /**
     * Key for title page translation.
     *
     * @default '${pageI18nKey}.title'
     */
    titleKey?: string
    /**
     * Key for title page translation.
     *
     * @default '${pageI18nKey}.description'
     */
    descriptionKey?: string
    /**
     * Are page messages registered globally?
     *
     * Beware using `isGlobal: false`, since you will need to
     * register the title and the description from the page component
     * from `onMounted` hook.
     *
     * @default true
     */
    isGlobal?: boolean
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
     * 2) `title` head element from `route.meta.title` or looking for it from the composer:
     * ```html
     * <title>TITLE</title>
     * ```
     * 3) `description` meta head from `route.meta.description` or looking for it from the composer:
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
    // @ts-ignore ignore when vue is not installed
    injectI18nMeta?: (
      head: HeadObject,
      locale: ViteSSGLocale,
      i18nComposer: Composer<Record<string, any>, unknown, unknown>,
      title?: string,
      description?: string,
    ) => HeadObject
    /**
     * Inject the following objects to `HeadObject` on `SSG`.
     *
     * The rest of data is configured by `injectI18nMeta`.
     *
     * 1) `title` head element from `route.meta.title` or looking for it from the composer:
     * ```html
     * <title>TITLE</title>
     * ```
     * 2) `description` meta head from `route.meta.description` or looking for it from the composer:
     * ```html
     * <meta name="description" content="<DESCRIPTION>">
     * ```
     */
    injectI18nSSGData?: (
      head: HeadObject,
      locale: ViteSSGLocale,
      translate: (key: string) => string | undefined,
      title?: string,
      description?: string,
    ) => HeadObject
    /**
     * Meta tags for alternative URLs.
     */
    // @ts-ignore ignore when vue is not installed
    crawling?: Crawling
  }
}

// extend vite.config.ts
declare module 'vite' {
  interface UserConfig {
    ssgOptions?: ViteSSGOptions
  }
}
