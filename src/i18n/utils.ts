import type { I18nConfigurationOptions } from '../utils/types'
import type { I18nOptions, LocaleInfo, ViteSSGLocale } from './types'

export function detectClientLocale(defaultLocale: string, localesMap: Map<string, ViteSSGLocale>): LocaleInfo {
  // todo@userquin: add cookie handling
  // navigator.languages:    Chrome & FF
  // navigator.language:     Safari & Others
  // navigator.userLanguage: IE & Others
  // @ts-ignore
  const languages = navigator.languages || [navigator.language || navigator.userLanguage]

  // lookup current or use default
  const current = languages.find(l => localesMap.has(l)) || defaultLocale

  return {
    current,
    locales: Array.from(localesMap.keys()).reduce((acc, locale) => {
      acc[locale] = localesMap.get(locale)!
      return acc
    }, {} as Record<string, ViteSSGLocale>),
  }
}

function createLocales(i18nOptions: I18nOptions): Map<string, ViteSSGLocale> {
  const locales: Record<string, string> = i18nOptions.locales || {}
  return Object.keys(locales).reduce((acc, locale) => {
    const [lang, country = undefined, variant = undefined] = locale.split('-')
    acc.set(locale, {
      locale,
      description: locales[locale],
      lang,
      country,
      variant,
    })
    return acc
  }, new Map<string, ViteSSGLocale>())
}

export function normalizeLocalePathVariable(localePathVariable?: string): string {
  localePathVariable = localePathVariable || 'locale'
  if (localePathVariable.startsWith('/'))
    localePathVariable = localePathVariable.substring(1)
  if (localePathVariable.startsWith(':'))
    localePathVariable = localePathVariable.substring(1)
  if (localePathVariable.endsWith('/'))
    localePathVariable = localePathVariable.substring(0, localePathVariable.length - 1)

  return localePathVariable
}
export function initializeI18n(base?: string, i18nOptions?: I18nOptions): {
  enabled: boolean
  info?: I18nConfigurationOptions
} {
  if (i18nOptions) {
    const localePathVariable = normalizeLocalePathVariable(i18nOptions.localePathVariable)
    return {
      enabled: true,
      info: {
        localesMap: createLocales(i18nOptions),
        defaultLocale: i18nOptions.defaultLocale,
        localePathVariable,
        base,
      },
    }
  }
  else {
    return { enabled: false }
  }
}

const serverAcceptLanguageRegex = /((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;q=[0-1](\.[0-9]+)?)?)*/g

function parseAcceptLanguageHeader(al: string): Array<string> {
  const result = (al || '').match(serverAcceptLanguageRegex)
  return result === null
    ? []
    : result.map((m) => {
      if (!m)
        return undefined

      const bits = m.split(';')
      const ietf = bits[0].split('-')
      const hasScript = ietf.length === 3

      return {
        code: ietf[0],
        script: hasScript ? ietf[1] : null,
        region: hasScript ? ietf[2] : ietf[1],
        quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0,
      }
    }).filter((r) => {
      return r !== undefined
    }).sort((a, b) => {
      return b!.quality - a!.quality
    }).map(r => r!.code)
}

export function detectServerLocale(
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
  acceptLanguage?: string,
  requestUrl?: string,
  localeCookie?: string,
): LocaleInfo {
  let current: string | undefined

  // 1) check for cookie
  if (localeCookie && localesMap.has(localeCookie))
    current = localeCookie

  // 2) check for request url
  if (!current && requestUrl && requestUrl !== '/') {
    const [locale] = requestUrl.split('/')
    if (localesMap.has(locale))
      current = locale
  }
  // 3) parse acceptLanguage and use the first found
  if (!current && acceptLanguage)
    current = parseAcceptLanguageHeader(acceptLanguage).find(l => localesMap.has(l))

  // todo@userquin: apply logic when not found
  // to be removed on compile time: https://vitejs.dev/guide/ssr.html#conditional-logic
  // if (process.env.SSR === 'true' || import.meta.env.SSR) {
  // if (requestHeaders && defaultLocale && localesMap) {
  //
  // }
  // }
  return {
    current: current || defaultLocale,
    locales: Array.from(localesMap.keys()).reduce((acc, locale) => {
      acc[locale] = localesMap.get(locale)!
      return acc
    }, {} as Record<string, ViteSSGLocale>),
  }
}
