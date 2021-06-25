import { I18nOptions, ViteSSGLocale } from '../i18n/types'
import { RouterOptions } from '../types'

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
