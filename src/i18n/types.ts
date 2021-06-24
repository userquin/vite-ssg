import { Composer, I18n } from 'vue-i18n'
import { ViteSSGContext } from '../types'
import type { Locale } from 'vue-i18n'
import type { HeadAttrs, HeadObject } from '@vueuse/head'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { Ref } from 'vue'

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

export type LocaleInfo = {
  current: Locale
  firstDetection: boolean
  locales: Record<Locale, ViteSSGLocale>
}

export type I18nGlobalMessageResolver = () => Record<string, any> | Promise<Record<string, any>>

export type I18nRouteMessageResolver = (
  locale: ViteSSGLocale,
  to: RouteLocationNormalized
) => (Record<string, any> | Promise<Record<string, any>> | undefined)

export type HeadConfigurer = (
  route: RouteLocationNormalized,
  headObject: Ref<HeadObject>,
  i18nComposer: Composer<Record<string, any>, unknown, unknown>,
  locale: ViteSSGLocale,
) => Promise<boolean> | boolean

export type CreateVueI18n = (
  ctx: ViteSSGContext<true>,
  globalMessageResolver?: I18nGlobalMessageResolver,
  routeMessageResolver?: I18nRouteMessageResolver,
  headConfigurer?: HeadConfigurer,
) => Promise<I18n<Record<string, any>, unknown, unknown, false>>

export interface I18nOptions {
  /**
   * Default locale for the application.
   */
  defaultLocale: Locale
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
   * The remote url for generating `crawling` info.
   */
  base?: string
  /**
   * Locale and its description.
   *
   * The `locale description` should be in its own `locale`, for example:
   *
   * `'en-US': 'American English'` or `'es-ES': 'Español de España'`
   */
  locales: Record<string, string>
  /**
   * Page messages info to localize the title and the description.
   */
  pageMessagesInfo?: {
    /**
     * Are the page messages registered globally?
     *
     * For example, you can have all your components pages with:
     *
     * <pre>
     * <i18n...>
     * </pre>
     *
     * or
     *
     * <pre>
     * <i18n global...>
     * </pre>
     *
     * We need to know if those pages resources are registered globally or locally.
     *
     * If you have the page resources registered lccally you will need to use:
     *
     * <pre>
     * setup() {
     *     const { t } = useI18n()
     * }
     * </pre>
     *
     * and then
     *
     * <pre>
     * <p>{{ t('page-b.someresource') }}</p>
     * </pre>
     *
     * while registering globally you will need:
     *
     * <pre>
     * setup() {
     *     const { t } = useI18n({ useScope: 'global' })
     * }
     * </pre>
     *
     */
    isGlobal: boolean
    /**
     * Page messages info.
     */
    /**
     * The prefix for the routes.
     *
     * This prefix is for the entry on your `resource` file:
     * ```json
     * "en": {
     *   "page-a": {
     *     "title": "Page A title",
     *     "description": "Page A description",
     *     ...<other page resources>
     *   }
     * }
     * "es": {
     *   "page-a": {
     *     "title": "Título de la página A",
     *     "description": "Descripción de página A",
     *     ...<other page resources>
     *   }
     * }
     * @default 'page-'.
     */
    prefix?: string
  }
}
