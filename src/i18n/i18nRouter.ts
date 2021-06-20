import { Composer, createI18n, I18n } from 'vue-i18n'
import { WritableComputedRef } from '@vue/reactivity'
import { createMemoryHistory, createRouter, createWebHistory, RouteRecordRaw, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'
import { CreateVueI18n, I18nRouteMessageResolver, LocaleInfo, ViteSSGLocale } from './types'
import { prepareHead } from './crawling'
import { provideDefaultLocale, provideLocales } from './composables'
import { detectClientLocale, detectServerLocale } from './utils'
import type { RouterOptions, ViteSSGContext } from '../types'
import type { Router } from 'vue-router'
import type { I18nConfigurationOptions, RouterConfiguration } from '../utils/types'

function createI18nFactory(
  locale: string,
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
  initialized: (
    context: ViteSSGContext<true>,
    i18n: I18n<Record<string, any>, unknown, unknown, false>,
    routeMessageResolver?: I18nRouteMessageResolver,
  ) => Promise<void>,
): CreateVueI18n {
  return async(
    context: ViteSSGContext<true>,
    globalI18nMessageResolver,
    routeMessageResolver,
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

    await initialized(context, i18n, routeMessageResolver)

    provideLocales(app, availableLocales)
    provideDefaultLocale(app, localesMap.get(defaultLocale)!)

    return i18n
  }
}

export function createI18nRouter(
  configuration: RouterConfiguration,
  i18nOptions: I18nConfigurationOptions,
): [Router, RouteRecordRaw[], LocaleInfo | undefined, CreateVueI18n | undefined] {
  const { client, isClient, routerOptions, requestHeaders } = configuration

  let localeInfo: LocaleInfo
  // eslint-disable-next-line prefer-const
  let { routes, ...useRouterOptions } = routerOptions

  const { localesMap, defaultLocale, localePathVariable } = i18nOptions
  let base: string | undefined
  if (client && isClient) {
    localeInfo = detectClientLocale(defaultLocale, localesMap)
    let baseRef = window.location.origin
    if (baseRef.endsWith('/'))
      baseRef = baseRef.substring(0, baseRef.length - 1)
    base = routerOptions.base || '/'
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

    // see availableLocales: simplify handling there the path to change the locale
    r.meta = r.meta || {}
    r.meta.rawPath = r.path

    return r
  })

  const localeRoutes: RouteRecordRaw[] = [{
    path: `/:${localePathVariable}?`,
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
  const createI18n = createI18nFactory(
    localeInfo?.current || defaultLocale,
    defaultLocale,
    localesMap,
    async(context, i18n, routeMessageResolver) => {
      const localeRef: WritableComputedRef<string> = ((i18n.global as unknown) as Composer).locale
      const localesArray = Object.values(localeInfo.locales)
      children.forEach((r) => {
        prepareHead(r, defaultLocale, localesArray, localeRef, base)
      })
      router.addRoute({
        path: '/:pathMatch(.*)*',
        redirect: () => '/',
      })
      let entryRoutePath: string | undefined
      let isFirstRoute = true
      // we only need handle the route change on the client side
      // we have calculated yet the current lang for SSR and SSG
      if (client && isClient) {
        // todo@userquin: include logic to change locale and load pages resources
        router.beforeEach(async(to, from, next) => {
          if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
            // The first route is rendered in the server and its state is provided globally.
            isFirstRoute = false
            entryRoutePath = to.path
            to.meta.state = context.initialState
          }

          next()
        })
      }
      else {
        router.beforeEach(async(to, from, next) => {
          if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
            // The first route is rendered in the server and its state is provided globally.
            isFirstRoute = false
            entryRoutePath = to.path
            to.meta.state = context.initialState
          }

          next()
        })
      }
    },
  )
  return [router, localeRoutes, localeInfo, createI18n]
}
