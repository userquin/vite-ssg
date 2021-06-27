import { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { WritableComputedRef } from '@vue/reactivity'
import { App, nextTick } from 'vue'
import {
  DefaultViteSSGLocale,
  I18nConfigurationOptions,
  I18nHeadConfigurer,
  ViteI18nSSGContext,
} from './types'
import { initializeHead } from './composables'
import type { I18nRouter } from './composables'
import type { Ref } from 'vue'
import type { I18nOptions, I18nRouteMessages, LocaleInfo, ViteSSGLocale } from './types'
import type { I18n, Locale } from 'vue-i18n'
import type { HeadClient, HeadObject } from '@vueuse/head'

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

export function initializeI18n(i18nOptions: I18nOptions, base?: string): I18nConfigurationOptions {
  const localePathVariable = normalizeLocalePathVariable(i18nOptions.localePathVariable)
  return {
    localesMap: createLocales(i18nOptions),
    defaultLocale: i18nOptions.defaultLocale,
    defaultLocaleOnUrl: i18nOptions.defaultLocaleOnUrl === true,
    localePathVariable,
    base,
    cookieName: i18nOptions.cookieName || 'VITE-SSG-LOCALE',
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
  headConfigurer?: I18nHeadConfigurer,
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
    to.meta.injectI18nMeta?.(headObject.value, locale, i18n.global)
}

async function loadPageMessages(
  locale: ViteSSGLocale,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  to: RouteLocationNormalized,
  globalMessages: Record<string, any> | undefined,
  routeMessages?: I18nRouteMessages,
) {
  // load locale messages
  if (routeMessages) {
    const localeCode = locale.locale
    let messages: Record<string, Record<string, any>> | undefined
    if (routeMessages)
      messages = await routeMessages(locale, to)

    if (messages && messages[localeCode]) {
      if (globalMessages && globalMessages[localeCode]) {
        await i18n.global.setLocaleMessage(localeCode, globalMessages[localeCode])
        await i18n.global.mergeLocaleMessage(localeCode, messages[localeCode])
      }
      else {
        await i18n.global.setLocaleMessage(localeCode, messages[localeCode])
      }
    }
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
  app: App,
  router: I18nRouter,
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
  routeMessages?: I18nRouteMessages,
  headConfigurer?: I18nHeadConfigurer,
) {
  const { path } = defaultLocale
  const requiredLocaleParam = path.length > 0
  const cookieInfo = {
    name: cookieName,
    base: cookieBase,
  }

  let firstDetectionPending = requiresHandlingFirstRoute
  // handle bad locale or missing required locale
  router.beforeEach((to, from, next) => {
    const paramsLocale = to.params.locale as string

    if ((paramsLocale && !localeMap.has(paramsLocale)) || (!paramsLocale && requiredLocaleParam)) {
      let useLocale = localeRef.value
      if (firstDetectionPending) {
        firstDetectionPending = false
        useLocale = localeInfo.current
      }
      next(resolveNewRouteLocationNormalized(
        router,
        defaultLocale,
        useLocale,
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
        isFirstRoute = false
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

  // the head object is updated before step 11 on router navigation guard on the new route
  // here were are ready to update the head, will be flush
  // the page resources are resolved here, since the component on afterEach is not yet resolved
  router.afterEach(async(to) => {
    const paramsLocale = to.params.locale as string

    const locale = localeMap.get(paramsLocale || defaultLocale.locale)!

    await loadPageMessages(
      locale,
      i18n,
      to,
      globalMessages,
      routeMessages,
    )

    await nextTick()

    localeRef.value = locale.locale

    const { name, base } = cookieInfo
    try {
      document.cookie = `${name}=${locale.locale};path=${base}; SameSite=Strict`
    }
    catch (e) {
      console.warn(`cannot configure cookie locale: ${name}`, e)
    }

    await nextTick()

    router.notifyHeadHandler?.(to.fullPath, headObject.value)

    await nextTick()

    await configureHead(
      to,
      headObject,
      i18n,
      localeMap.get(localeRef.value)!,
      headConfigurer,
    )

    await nextTick()

    head?.updateDOM()
  })
}

export async function configureRouteEntryServer(
  route: string,
  router: I18nRouter,
  context: ViteI18nSSGContext,
  headObject: Ref<HeadObject>,
  localeRef: WritableComputedRef<Locale>,
  defaultLocale: DefaultViteSSGLocale,
  localeMap: Map<string, ViteSSGLocale>,
  locale: ViteSSGLocale,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  globalMessages: Record<string, any> | undefined,
  routeMessages?: I18nRouteMessages,
  headConfigurer?: I18nHeadConfigurer,
) {
  // on SSG we need to do at the end: see node/build.ts
  if (process.env.VITE_SSG === 'true') {
    context.injectI18nSSG = async() => {
      await nextTick()
      router.notifyHeadHandler?.(route.startsWith('/') ? route : `/${route}`, headObject.value)
      await nextTick()
      const to = router.currentRoute.value
      await configureHead(
        to,
        headObject,
        i18n,
        locale,
        headConfigurer,
      )
    }
  }
  // else {
  //   router.afterEach(async(to) => {
  //     const paramsLocale = to.params.locale as string
  //
  //     const locale = localeMap.get(paramsLocale || defaultLocale.locale)!
  //
  //     await loadPageMessages(
  //       locale,
  //       i18n,
  //       to,
  //       globalMessages,
  //       routeMessages,
  //     )
  //
  //     await nextTick()
  //
  //     localeRef.value = locale.locale
  //
  //     await nextTick()
  //
  //     router.notifyHeadHandlers?.(headObject.value)
  //
  //     await nextTick()
  //
  //     // update header
  //     await configureHead(
  //       to,
  //       headObject,
  //       i18n,
  //       locale,
  //       headConfigurer,
  //     )
  //   })
  // }
}
