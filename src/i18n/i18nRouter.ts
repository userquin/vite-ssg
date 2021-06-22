import { createI18n, I18n } from 'vue-i18n'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  RouterView,
} from 'vue-router'
import { defineComponent, h, ref } from 'vue'
import { HeadObject } from '@vueuse/head'
import { CreateVueI18n, HeadConfigurer, I18nRouteMessageResolver, LocaleInfo, ViteSSGLocale } from './types'
import { prepareHead } from './crawling'
import { provideDefaultLocale, provideHeadObject, provideLocales } from './composables'
import {
  createLocalePathRoute,
  detectClientLocale,
  detectServerLocale,
  configureClientNavigationGuards,
  configureRouteEntryServer,
} from './utils'
import type { ViteSSGContext } from '../types'
import type { Router } from 'vue-router'
import type { I18nConfigurationOptions, RouterConfiguration } from '../utils/types'

function createI18nFactory(
  locale: string,
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
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
    const i18n = createI18n({
      legacy: false,
      fallbackLocale: defaultLocale,
      availableLocales: availableLocales.map(l => l.locale),
      messages: messages || {},
      locale,
    })

    const { app } = context

    app.use(i18n)

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
    createVueI18n?: CreateVueI18n
    fn?: (context: ViteSSGContext<true>) => Promise<void> | void
  } {
  const { client, isClient, routerOptions, requestHeaders } = configuration

  let localeInfo: LocaleInfo
  // eslint-disable-next-line prefer-const
  let { routes, ...useRouterOptions } = routerOptions

  const { localesMap, defaultLocale, localePathVariable } = i18nOptions
  let base: string | undefined
  if (client && isClient) {
    localeInfo = detectClientLocale(defaultLocale, localesMap)
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

    // see availableLocales: simplify handling there, the path to change the locale
    r.meta = r.meta || {}
    r.meta.rawPath = r.path
    r.meta.rawI18nPath = r.path.length > 0 ? r.path : 'index'

    return r
  })

  const localeRoutes: RouteRecordRaw[] = [{
    path: createLocalePathRoute(localePathVariable),
    component: defineComponent({
      inheritAttrs: false,
      render() {
        return h(RouterView)
      },
    }),
    children,
  }]

  const router = createRouter({
    history: client
      ? createWebHistory(routerOptions.base)
      : createMemoryHistory(routerOptions.base),
    ...useRouterOptions,
    routes: localeRoutes,
  })
  const createVueI18n = createI18nFactory(
    localeInfo?.current || defaultLocale,
    defaultLocale,
    localesMap,
    async(
      context,
      i18n,
      globalMessages,
      routeMessageResolver,
      headConfigurer?: HeadConfigurer,
    ) => {
      // const localeRef: WritableComputedRef<string> = ((i18n.global as unknown) as Composer).locale
      const localeRef = i18n.global.locale
      const localesArray = Object.values(localeInfo.locales)
      const headObject = ref<HeadObject>({})

      const { app, head } = context

      head!.addHeadObjs(headObject)

      provideLocales(app, Array.from(localesMap.values()))
      provideDefaultLocale(app, localesMap.get(defaultLocale)!)
      provideHeadObject(app, headObject)

      children.forEach((r) => {
        prepareHead(routerOptions, r, defaultLocale, localesArray, localeRef, base)
      })
      // todo@userquin: this will be required?
      router.addRoute({
        path: '/:pathMatch(.*)*',
        redirect: () => '/',
      })
      // we only need handle the route logic on the client side
      if (client && isClient) {
        configureClientNavigationGuards(
          router,
          head!,
          headObject,
          localeInfo,
          defaultLocale,
          localesMap,
          localeRef,
          i18n,
          globalMessages,
          routeMessageResolver,
          headConfigurer,
        )
      }
      else {
        configureRouteEntryServer(
          router,
          context,
          headObject,
          defaultLocale,
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
  // we need to provide a hook to initialize: the problem here is the SSR state
  if (!fn) {
    fn = (context) => {
      context.createI18n?.(context)
    }
  }
  return { router, routes: localeRoutes, localeInfo, createVueI18n, fn }
}
