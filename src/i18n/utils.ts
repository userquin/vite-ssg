import { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import { WritableComputedRef } from '@vue/reactivity'
import { nextTick } from 'vue'
import { Composer } from 'vue-i18n'
import { ViteSSGContext } from '../types'
import { HeadConfigurer } from './types'
import type { Ref } from 'vue'
import type { I18nConfigurationOptions } from '../utils/types'
import type { I18nOptions, I18nRouteMessageResolver, LocaleInfo, ViteSSGLocale } from './types'
import type { I18n, Locale } from 'vue-i18n'
import type { HeadClient, HeadObject } from '@vueuse/head'

export function detectClientLocale(defaultLocale: string, localesMap: Map<string, ViteSSGLocale>): LocaleInfo {
  // todo@userquin: add cookie handling?
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

export function createLocalePathRoute(localePathVariable?: string): string {
  return `/:${normalizeLocalePathVariable(localePathVariable)}?`
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
    }).map((r) => {
      if (r!.region)
        return `${r!.code}-${r!.region}`

      return r!.code
    })
}

export function detectServerLocale(
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
  acceptLanguage?: string,
  requestUrl?: string,
  localeCookie?: string,
): LocaleInfo {
  let current: string | undefined

  // 1) check for cookie: SSR
  if (localeCookie && localesMap.has(localeCookie))
    current = localeCookie

  // 2) check for request url
  if (!current && requestUrl && requestUrl !== '/') {
    const useRequestUrl = requestUrl.startsWith('/') ? requestUrl.substring(1) : requestUrl
    if (useRequestUrl.length > 0) {
      const idx = useRequestUrl.indexOf('/')
      if (idx > 0) {
        const locale = useRequestUrl.substring(0, idx)
        if (localesMap.has(locale))
          current = locale
      }
    }
  }

  // 3) parse acceptLanguage and use the first found
  if (!current && acceptLanguage)
    current = parseAcceptLanguageHeader(acceptLanguage).find(l => localesMap.has(l))

  return {
    current: current || defaultLocale,
    locales: Array.from(localesMap.keys()).reduce((acc, locale) => {
      acc[locale] = localesMap.get(locale)!
      return acc
    }, {} as Record<string, ViteSSGLocale>),
  }
}

function configureHead(
  to: RouteLocationNormalized,
  headObject: HeadObject,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  locale: ViteSSGLocale,
  headConfigurer?: HeadConfigurer,
) {
  if (headConfigurer) {
    headConfigurer(
      to,
      headObject,
      i18n.global,
      locale,
    )
  }
  else {
    to.meta.injectI18nMeta?.(headObject, locale)
  }
}

export async function loadResourcesAndChangeLocale(
  locale: ViteSSGLocale,
  localeRef: WritableComputedRef<Locale>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  to: RouteLocationNormalized,
  globalMessages: Record<string, any> | undefined,
  routeMessageResolver?: I18nRouteMessageResolver,
) {
  // load locale messages
  const localeCode = locale.locale
  if (routeMessageResolver) {
    let messages: Record<string, Record<string, any>> | undefined
    if (routeMessageResolver)
      messages = await routeMessageResolver(locale, to)

    if (messages && messages[localeCode]) {
      if (globalMessages && globalMessages[localeCode]) {
        i18n.global.setLocaleMessage(localeCode, globalMessages[localeCode])
        i18n.global.mergeLocaleMessage(localeCode, messages[localeCode])
      }
      else {
        i18n.global.setLocaleMessage(localeCode, messages[localeCode])
      }
    }
  }

  localeRef.value = localeCode

  await nextTick()
}

export function configureClientNavigationGuards(
  router: Router,
  head: HeadClient,
  headObject: Ref<HeadObject>,
  localeInfo: LocaleInfo,
  defaultLocale: string,
  localeMap: Map<string, ViteSSGLocale>,
  localeRef: WritableComputedRef<Locale>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  globalMessages: Record<string, any> | undefined,
  routeMessageResolver?: I18nRouteMessageResolver,
  headConfigurer?: HeadConfigurer,
) {
  let isFirstRoute = true
  const isFirstRouteAfterEach = true
  router.beforeEach(async(to, from, next) => {
    const paramsLocale = to.params.locale as string

    if ((paramsLocale && !localeMap.has(paramsLocale)) || isFirstRoute) {
      let rawPath = to.meta.rawPath!
      if (rawPath.length > 0)
        rawPath = `/${rawPath}`
      if (isFirstRoute) {
        isFirstRoute = false
        const locale = paramsLocale || defaultLocale
        if (locale !== localeRef.value) {
          next({ path: `/${localeInfo.current}${rawPath}`, force: true })
          return
        }
      }
      else {
        next({ path: `/${localeRef.value}`, force: true })
        return
      }
    }

    const locale = localeMap.get(paramsLocale || defaultLocale)!

    await loadResourcesAndChangeLocale(
      locale,
      localeRef,
      i18n,
      to,
      globalMessages,
      routeMessageResolver,
    )

    next()
  })
  // the head object is updated before step 11 on router navigation guard on the new route
  router.afterEach(async(to) => {
    // if (isFirstRouteAfterEach) {
    //   isFirstRouteAfterEach = false
    // todo@userquin: we need to check if SSR then done otherwise we need to inject the header
    // }
    // else {
    configureHead(
      to,
      headObject.value,
      i18n,
      localeMap.get(localeRef.value)!,
      headConfigurer,
    )
    await nextTick()
    head.updateDOM(document)
    // }
  })
}

export function handleFirstRouteEntryServer(
  context: ViteSSGContext<true>,
  headObject: Ref<HeadObject>,
  defaultLocale: string,
  localeMap: Map<string, ViteSSGLocale>,
  localeRef: WritableComputedRef<Locale>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  globalMessages: Record<string, any> | undefined,
  routeMessageResolver?: I18nRouteMessageResolver,
  headConfigurer?: HeadConfigurer,
): ((to: RouteLocationNormalized) => Promise<void>) {
  let entryRoutePath: string | undefined
  let isFirstRoute = true
  return async(to) => {
    console.log(`${to.path} => ${to.params.locale}`)
    const paramsLocale = to.params.locale as string || defaultLocale

    const locale = localeMap.get(paramsLocale || defaultLocale)!

    await loadResourcesAndChangeLocale(
      locale,
      localeRef,
      i18n,
      to,
      globalMessages,
      routeMessageResolver,
    )

    configureHead(
      to,
      headObject.value,
      i18n,
      locale,
      headConfigurer,
    )

    if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
      // The first route is rendered in the server and its state is provided globally.
      isFirstRoute = false
      entryRoutePath = to.path
      to.meta.state = context.initialState
    }
  }
}
