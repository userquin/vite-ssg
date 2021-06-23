import { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { WritableComputedRef } from '@vue/reactivity'
import { nextTick } from 'vue'
import { ViteSSGContext } from '../types'
import { DefaultViteSSGLocale, HeadConfigurer } from './types'
import type { Ref } from 'vue'
import type { I18nConfigurationOptions } from '../utils/types'
import type { I18nOptions, I18nRouteMessageResolver, LocaleInfo, ViteSSGLocale } from './types'
import type { I18n, Locale } from 'vue-i18n'
import type { HeadClient, HeadObject, HeadObjectPlain } from '@vueuse/head'

export function detectPreferredClientLocale(defaultLocale: Locale, localesMap: Map<string, ViteSSGLocale>) {
  // navigator.languages:    Chrome & FF
  // navigator.language:     Safari & Others
  // navigator.userLanguage: IE & Others
  // @ts-ignore
  const languages = navigator.languages || [navigator.language || navigator.userLanguage]

  // lookup current or use default
  return languages.find(l => localesMap.has(l)) || defaultLocale
}

export function detectClientLocale(cookieName: string, defaultLocale: string, localesMap: Map<string, ViteSSGLocale>): LocaleInfo {
  let current: Locale | undefined
  let firstDetection = true

  // check for cookie present
  const cookie = new Map<string, string>(
    document.cookie.split('; ').map((c) => {
      const [name, value] = c.split('=')
      return [name, value]
    }),
  ).get(cookieName)

  if (cookie && localesMap.has(cookie)) {
    current = cookie
    firstDetection = false
  }
  else {
    // navigator.languages:    Chrome & FF
    // navigator.language:     Safari & Others
    // navigator.userLanguage: IE & Others
    // @ts-ignore
    const languages = navigator.languages || [navigator.language || navigator.userLanguage]

    // lookup current or use default
    current = detectPreferredClientLocale(defaultLocale, localesMap)
  }

  return {
    current,
    firstDetection,
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
        cookieName: i18nOptions.cookieName || 'VITE-SSG-LOCALE',
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
    // @todo@userquin: for SSR enabled middleware??
    firstDetection: false,
    locales: Array.from(localesMap.keys()).reduce((acc, locale) => {
      acc[locale] = localesMap.get(locale)!
      return acc
    }, {} as Record<string, ViteSSGLocale>),
  }
}

async function configureHead(
  to: RouteLocationNormalized,
  headObject: Ref<HeadObject>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  locale: ViteSSGLocale,
  headConfigurer?: HeadConfigurer,
) {
  let resolved = false
  if (headConfigurer) {
    resolved = await headConfigurer(
      to,
      headObject,
      i18n.global,
      locale,
    )
  }
  if (!resolved)
    to.meta.injectI18nMeta?.(headObject.value, locale)
}

export async function loadResourcesAndChangeLocale(
  locale: ViteSSGLocale,
  localeRef: WritableComputedRef<Locale>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  to: RouteLocationNormalized,
  globalMessages: Record<string, any> | undefined,
  routeMessageResolver?: I18nRouteMessageResolver,
  cookieInfo?: {
    name: string
    base: string
  },
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

  if (cookieInfo) {
    const { name, base } = cookieInfo
    document.cookie = `${name}=${localeCode};path=${base}; SameSite=Strict`
  }
}

export function resolveNewRouteLocationNormalized(
  router: Router,
  defaultLocale: DefaultViteSSGLocale,
  currentLocale: Locale,
  route?: RouteLocationNormalized,
) {
  const { path, localePathVariable } = defaultLocale

  const params = {} as any
  if (currentLocale === defaultLocale.locale)
    params[`${localePathVariable}`] = path
  else
    params[`${localePathVariable}`] = currentLocale

  return router.resolve({ params }, route)
}

export function resolveNewRawLocationRoute(
  router: Router,
  to: RouteLocationRaw,
  defaultLocale: DefaultViteSSGLocale,
  currentLocale: Locale,
) {
  return resolveNewRouteLocationNormalized(router, defaultLocale, currentLocale, router.resolve(to)).fullPath
}

export function configureClientNavigationGuards(
  router: Router,
  head: HeadClient,
  headObject: Ref<HeadObject>,
  localeInfo: LocaleInfo,
  defaultLocale: DefaultViteSSGLocale,
  localeMap: Map<string, ViteSSGLocale>,
  localeRef: WritableComputedRef<Locale>,
  cookieName: string,
  cookieBase: string,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  globalMessages: Record<string, any> | undefined,
  requiresHandlingFirstRoute: boolean,
  routeMessageResolver?: I18nRouteMessageResolver,
  headConfigurer?: HeadConfigurer,
) {
  const { path } = defaultLocale
  const requiredLocaleParam = path.length > 0
  const cookieInfo = {
    name: cookieName,
    base: cookieBase,
  }

  // handle bad locale or missing required locale
  router.beforeEach((to, from, next) => {
    const paramsLocale = to.params.locale as string

    if ((paramsLocale && !localeMap.has(paramsLocale)) || (!paramsLocale && requiredLocaleParam)) {
      next(resolveNewRouteLocationNormalized(
        router,
        defaultLocale,
        requiresHandlingFirstRoute ? localeInfo.current : localeRef.value,
        to,
      ).fullPath)
    }
    else {
      next()
    }
  })

  // handle initial request calculating forwarding/redirecting to preferred locale
  if (requiresHandlingFirstRoute) {
    let isFirstRoute = true
    router.beforeEach((to, from, next) => {
      const paramsLocale = to.params.locale as string || defaultLocale
      if (isFirstRoute) {
        isFirstRoute = true
        const currentLocale = localeRef.value
        if (paramsLocale !== currentLocale) {
          next(resolveNewRouteLocationNormalized(
            router,
            defaultLocale,
            currentLocale,
            to,
          ).fullPath)
        }
        else {
          next()
        }
      }
      else {
        next()
      }
    })
  }

  // handle loading resources
  router.beforeEach(async(to, from, next) => {
    const paramsLocale = to.params.locale as string

    const locale = localeMap.get(paramsLocale || defaultLocale.locale)!

    await loadResourcesAndChangeLocale(
      locale,
      localeRef,
      i18n,
      to,
      globalMessages,
      routeMessageResolver,
      cookieInfo,
    )

    await next()
  })
  let isFirstRouteAfterEach = true
  // the head object is updated before step 11 on router navigation guard on the new route
  // here were are ready to update the head, will be flush
  router.afterEach(async(to) => {
    if (isFirstRouteAfterEach) {
      isFirstRouteAfterEach = false
    }
    else {
      await configureHead(
        to,
        headObject,
        i18n,
        localeMap.get(localeRef.value)!,
        headConfigurer,
      )
      await nextTick()
      head.updateDOM()
    }
  })

  router.push({ path: window.location.pathname })
}

export function configureRouteEntryServer(
  router: Router,
  context: ViteSSGContext<true>,
  headObject: Ref<HeadObject>,
  defaultLocale: string,
  localeMap: Map<string, ViteSSGLocale>,
  localeRef: WritableComputedRef<Locale>,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  globalMessages: Record<string, any> | undefined,
  routeMessageResolver?: I18nRouteMessageResolver,
  headConfigurer?: HeadConfigurer,
) {
  let entryRoutePath: string | undefined
  let isFirstRoute = true

  router.beforeEach(async(to, from, next) => {
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

    await configureHead(
      to,
      headObject,
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

    await next()
  })
}
