import { createI18n, I18n } from 'vue-i18n'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  RouterView,
} from 'vue-router'
import { defineComponent, h, nextTick, Ref, ref } from 'vue'
import { HeadObject, HeadObjectPlain } from '@vueuse/head'
import { CreateVueI18n, HeadConfigurer, I18nRouteMessageResolver, LocaleInfo, ViteSSGLocale } from './types'
import { prepareHead } from './crawling'
import { provideDefaultLocale, provideHeadObject, provideLocales } from './composables'
import {
  createLocalePathRoute,
  detectClientLocale,
  detectServerLocale,
  configureClientNavigationGuards,
  configureRouteEntryServer,
  normalizeLocalePathVariable,
} from './utils'
import type { ViteSSGContext } from '../types'
import type { Router } from 'vue-router'
import type { I18nConfigurationOptions, RouterConfiguration } from '../utils/types'

function createI18nFactory(
  locale: string,
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
  isGlobal: boolean,
  initialized: (
    context: ViteSSGContext<true>,
    i18n: I18n<Record<string, any>, unknown, unknown, false>,
    globalMessages: Record<string, any> | undefined,
    routeMessageResolver?: I18nRouteMessageResolver,
    headConfigurer?: HeadConfigurer,
  ) => Promise<void>,
): CreateVueI18n {
  return async(
    context: ViteSSGContext<true>,
    globalI18nMessageResolver,
    routeMessageResolver,
    headConfigurer?: HeadConfigurer,
  ) => {
    const availableLocales = Array.from(localesMap.values())

    let messages: Record<string, any> | undefined

    if (typeof globalI18nMessageResolver === 'function')
      messages = await globalI18nMessageResolver()
    else if (globalI18nMessageResolver)
      messages = globalI18nMessageResolver

    // todo@userquin: maybe we can accept some options on CreateVueI18nFn and merge here
    // todo@userquin: review also globalInjection argument
    const i18n = createI18n({
      legacy: false,
      globalInjection: true,
      fallbackLocale: defaultLocale,
      availableLocales: availableLocales.map(l => l.locale),
      messages: messages || {},
      locale,
    })

    await initialized(
      context,
      i18n,
      messages,
      routeMessageResolver,
      headConfigurer,
    )

    return i18n
  }
}

export function createI18nRouter(
  configuration: RouterConfiguration,
  i18nOptions: I18nConfigurationOptions,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
): {
    router: Router
    routes: RouteRecordRaw[]
    localeInfo?: LocaleInfo
    requiresMapDefaultLocale?: boolean
    createVueI18n?: CreateVueI18n
    fn?: (context: ViteSSGContext<true>) => Promise<void> | void
  } {
  const { client, isClient, routerOptions, requestHeaders } = configuration

  let localeInfo: LocaleInfo
  // eslint-disable-next-line prefer-const
  let { routes, ...useRouterOptions } = routerOptions

  const {
    localesMap,
    defaultLocale,
    defaultLocaleOnUrl,
    localePathVariable,
    cookieName,
    prefix,
    isGlobal,
  } = i18nOptions

  let base: string | undefined
  if (client && isClient) {
    localeInfo = detectClientLocale(cookieName, defaultLocale, localesMap)
    base = window.location.origin
    if (base.endsWith('/'))
      base = base.substring(0, base.length - 1)
    const baseRef = routerOptions.base || ''
    if (baseRef.startsWith('/'))
      base += baseRef
    else
      base += `/${baseRef}`
  }
  else {
    base = i18nOptions.base

    localeInfo = detectServerLocale(
      defaultLocale,
      localesMap,
      requestHeaders?.acceptLanguage,
      requestHeaders?.requestUrl,
      requestHeaders?.localeCookie,
    )
  }

  const children = routes.map((r) => {
    if (r.path.startsWith('/'))
      r.path = r.path.substring(1)

    r.meta = r.meta || {}

    const pageI18nKey = r.meta.pageI18nKey
    if (!pageI18nKey) {
      const routeName = r.name?.toString() || r.path
      r.meta.pageI18nKey = `${prefix}${routeName}`
    }

    if (!r.meta.titleKey)
      r.meta.titleKey = `${r.meta.pageI18nKey}.title`

    if (!r.meta.descriptionKey)
      r.meta.descriptionKey = `${r.meta.pageI18nKey}.description`

    if (r.meta.isGlobal === undefined)
      r.meta.isGlobal = true

    return r
  })

  const normalizedLocalePathVariable = normalizeLocalePathVariable(localePathVariable)

  const localeRoutes: RouteRecordRaw[] = [{
    path: createLocalePathRoute(normalizedLocalePathVariable),
    component: defineComponent({
      inheritAttrs: false,
      render() {
        return h(RouterView)
      },
    }),
    children,
  }]

  // check for top dynamic routes
  const requiresMapDefaultLocale = defaultLocaleOnUrl || children.some((r) => {
    return r.path.startsWith(':') || r.path.includes('*')
  })

  // create the router
  const router = createRouter({
    history: client
      ? createWebHistory(routerOptions.base)
      : createMemoryHistory(routerOptions.base),
    ...useRouterOptions,
    routes: localeRoutes,
  })

  // prepare i18n callback
  const createVueI18n = createI18nFactory(
    localeInfo?.current || defaultLocale,
    defaultLocale,
    localesMap,
    isGlobal,
    async(
      context,
      i18n,
      globalMessages,
      routeMessageResolver,
      headConfigurer?: HeadConfigurer,
    ) => {
      const localeRef = i18n.global.locale
      const localesArray = Object.values(localeInfo.locales)
      const headObject = ref<HeadObject>({}) as Ref<HeadObjectPlain>

      const { app, head } = context

      // prepare head for each route
      children.forEach((r) => {
        prepareHead(router, routerOptions, r, defaultLocale, localesArray, localeRef, base)
      })

      // build the default locale info
      const defaultViteSSGLocale = {
        ...localesMap.get(defaultLocale)!,
        path: requiresMapDefaultLocale ? defaultLocale : '',
        localePathVariable: normalizedLocalePathVariable,
      }

      // provide some helpers
      provideLocales(app, Array.from(localesMap.values()))
      provideHeadObject(app, headObject)
      provideDefaultLocale(app, defaultViteSSGLocale)

      // warn the user if we need to change path for default locale
      if (requiresMapDefaultLocale && !defaultLocaleOnUrl) {
        console.warn('vite-ssg:routes: you have at least a top route that is dynamic, the default locale will be shown on the url')
        console.warn(`vite-ssg:routes: ☝ the default locale should be /, with your routes, we need to change to /${defaultLocale}/`)
      }

      // register the head object
      head!.addHeadObjs(headObject)

      app.use(i18n)
      app.use(router)

      // we only need handle the route logic on the client side
      if (client && isClient) {
        configureClientNavigationGuards(
          router,
          head!,
          headObject,
          localeInfo,
          defaultViteSSGLocale,
          localesMap,
          localeRef,
          cookieName,
          routerOptions.base || '/',
          i18n,
          globalMessages,
          localeInfo.firstDetection,
          routeMessageResolver,
          headConfigurer,
        )
      }
      else {
        localeRef.value = localeInfo.current

        await nextTick()

        await configureRouteEntryServer(
          requestHeaders?.requestUrl || routerOptions.base || '/',
          router,
          context,
          headObject,
          defaultViteSSGLocale,
          localesMap,
          localeRef,
          i18n,
          globalMessages,
          routeMessageResolver,
          headConfigurer,
        )
      }
    },
  )
  // we need to provide a hook to initialize if the user omit it
  // by default wrap it: we need to await initialization
  const useFn: ((context: ViteSSGContext<true>) => Promise<void> | void) = async(context) => {
    if (fn)
      await fn(context)

    else
      await createVueI18n(context)
  }

  // return i18n stuff
  return { router, routes: localeRoutes, localeInfo, requiresMapDefaultLocale, createVueI18n, fn: useFn }
}
