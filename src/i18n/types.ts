import { Composer, I18n } from 'vue-i18n'
import { RouterOptions, ViteSSGClientOptions, ViteSSGContext, ViteSSGOptions } from '../types'
import { useAvailableLocales, useI18nRouter, injectHeadObject, useGlobalI18n, addMetaHeadName, addMetaHeadProperty, registerCustomHeadHandler } from './composables'
import type { CustomHeadHandler } from './composables'
import type { Locale } from 'vue-i18n'
import type { HeadAttrs, HeadClient, HeadObject } from '@vueuse/head'
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import type { Ref } from 'vue'

export type ViteSSGLocale = {
  locale: Locale
  description: string
  lang: string
  country?: string
  variant?: string
}

export type DefaultViteSSGLocale = ViteSSGLocale & { path: string; localePathVariable: string }

export type AvailableLocale = {
  locale: Locale
  description: string
  current: boolean
  to: RouteLocationRaw
}

export type I18nGlobalMessages = (() => Promise<Record<string, any>>) | Record<string, any>

export type I18nRouteMessages = (
  locale: ViteSSGLocale,
  to: RouteLocationNormalized
) => Promise<Record<string, any>> | Record<string, any> | undefined

export type I18nHeadConfigurer = (
  route: RouteLocationNormalized,
  headObject: Ref<HeadObject>,
  i18nComposer: Composer<Record<string, any>, unknown, unknown>,
  locale: ViteSSGLocale,
) => Promise<boolean> | boolean

export interface I18nOptions {
  /**
   * Default locale for the application.
   */
  defaultLocale: Locale
  /**
   * Locale and its description.
   *
   * The `locale description` should be in its own `locale`, for example:
   *
   * `'en-US': 'American English'` or `'es-ES': 'Español de España'`
   */
  locales: Record<string, string>
  /**
   * Should default locale be shown in the url?
   *
   * @default false
   */
  defaultLocaleOnUrl?: boolean
  /**
   * The path variable to match the locale.
   *
   * @default 'locale'
   */
  localePathVariable?: string
  /**
   * Locale cookie name.
   *
   * @default 'VITE-SSG-LOCALE'
   */
  cookieName?: string
  /**
   * The remote url for generating `alternate` info.
   */
  base?: string
  /**
   * Global messages resources.
   */
  globalMessages?: I18nGlobalMessages
  /**
   * If not using `<i18n>` custom block on your `SFC` page component, you can customize configureing this callback.
   */
  routeMessages?: I18nRouteMessages
  /**
   * If you need to customize the head configure this callback.
   */
  headConfigurer?: I18nHeadConfigurer
}

export interface ViteI18nSSGContext extends ViteSSGContext<true> {
  router: Router
  head: HeadClient
  defaultLocale: string
  locales: ViteSSGLocale[]
  defaultLocaleOnUrl: boolean
  localePathVariable: string
  i18n: I18n<Record<string, any>, unknown, unknown, false>
  injectI18nSSG?: () => Promise<void>
}

export interface ViteI18nSSGOptions extends ViteSSGOptions {
  /**
   * Base foralternate hrefs.
   */
  alternateHrefsBase?: string
}

export interface ViteI18nSSGClientOptions extends ViteSSGClientOptions {
  /**
   * I18n options.
   */
  i18nOptions: I18nOptions
}

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

export type LocaleInfo = {
  current: Locale
  firstDetection: boolean
  locales: Record<Locale, ViteSSGLocale>
}

export { CustomHeadHandler, useAvailableLocales, useI18nRouter, injectHeadObject, useGlobalI18n, addMetaHeadName, addMetaHeadProperty, registerCustomHeadHandler }

export type I18nConfigurationOptions = {
  localesMap: Map<string, ViteSSGLocale>
  defaultLocale: string
  defaultLocaleOnUrl: boolean
  localePathVariable: string
  cookieName: string
  base?: string
}

export type RouterConfiguration = {
  client: boolean
  isClient: boolean
  routerOptions: RouterOptions
  requestHeaders?: {
    acceptLanguage?: string
    requestUrl?: string
    localeCookie?: string
  }
  i18nOptions: I18nOptions
  i18n: I18nConfigurationOptions
}

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
     * Key for `og:image`.
     *
     * @default '${pageI18nKey}.image'
     */
    imageKey?: string
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
     * 2) `title` head element from `route.meta.title` or looking for it from the `i18n` composer:
     * ```html
     * <title><TITLE></title>
     * ```
     * 3) `description` meta head from `route.meta.description` or looking for it from the `i18n` composer:
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
      image?: string,
    ) => HeadObject
    /**
     * Meta tags for alternative URLs.
     */
    // @ts-ignore ignore when vue is not installed
    crawling?: Crawling
  }
}
