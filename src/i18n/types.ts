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

export type AvailableLocale = {
  locale: Locale
  description: string
  current: boolean
  to: RouteLocationRaw
}

export type LocaleInfo = {
  current: Locale
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
}
