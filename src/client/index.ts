import { createSSRApp, Component, createApp as createClientApp, ref } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import { createHead } from '@vueuse/head'
import { WritableComputedRef } from '@vue/reactivity'
import { I18n } from 'vue-i18n'
import { deserializeState, serializeState } from '../utils/state'
import {
  buildLocaleRoute, createI18nFactory,
  detectClientLocale,
  detectServerLocale,
  initializeI18n,
} from '../utils/i18n'
import { ClientOnly } from './components/ClientOnly'
import type { HeadClient } from '@vueuse/head'
import type { ViteSSGContext, ViteSSGClientOptions, RouterOptions, LocaleInfo, CreateVueI18nFn } from '../types'

export * from '../types'
export { useAvailableLocales } from '../utils/i18n'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  options: ViteSSGClientOptions = {},
) {
  const {
    transformState,
    registerComponents = true,
    useHead = true,
    rootContainer = '#app',
    i18nOptions,
  } = options
  const isClient = typeof window !== 'undefined'
  const i18nInfo = initializeI18n(i18nOptions)

  async function createApp(client = false, requestHeaders?: { acceptLanguage?: string; requestUrl?: string }) {
    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let head: HeadClient | undefined

    if (useHead || i18nOptions) {
      head = createHead()
      app.use(head)
    }

    let localeInfo: LocaleInfo | undefined
    // eslint-disable-next-line prefer-const
    let { routes, ...useRouterOptions } = routerOptions
    let usingRouterOptions = routerOptions

    // @ts-ignore
    let vueI18n: I18n<Record<string, any>, unknown, unknown, false> | undefined

    if (i18nInfo.info) {
      const localeRefResolver: () => WritableComputedRef<string> | undefined = () => {
        return vueI18n?.global?.locale
      }
      const { localesMap, defaultLocale, localePathVariable } = i18nInfo.info
      let baseHref: string | undefined
      if (client) {
        localeInfo = detectClientLocale(defaultLocale, localesMap)
        baseHref = window.location.origin
        if (baseHref.endsWith('/'))
          baseHref = baseHref.substring(0, baseHref.length - 1)
        const base = routerOptions.base || '/'
        if (base.startsWith('/'))
          baseHref += base
        else
          baseHref += `/${base}`
      }
      else {
        ({ localeInfo, baseHref } = detectServerLocale(requestHeaders, defaultLocale, localesMap))
      }

      routes = buildLocaleRoute(
        routes,
        localeRefResolver,
        localeInfo,
        localePathVariable,
        defaultLocale,
        baseHref,
      )
      usingRouterOptions = {
        ...useRouterOptions,
        routes,
      }
    }

    const router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...usingRouterOptions,
    })

    app.use(router)

    if (registerComponents)
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })

    // @ts-ignore
    let createI18n: CreateVueI18nFn | undefined
    if (i18nInfo.info) {
      createI18n = createI18nFactory(
        i18nInfo.info.defaultLocale,
        i18nInfo.info.localesMap,
        (i18n) => {
          vueI18n = i18n
        },
      )
    }

    const context: ViteSSGContext<true> = { app, head, isClient, router, routes, createI18n, localeInfo, initialState: {} }

    if (client)
      // @ts-ignore
      context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

    await fn?.(context)

    let entryRoutePath: string | undefined
    let isFirstRoute = true
    router.beforeEach((to, from, next) => {
      if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
        // The first route is rendered in the server and its state is provided globally.
        isFirstRoute = false
        entryRoutePath = to.path
        to.meta.state = context.initialState
      }

      next()
    })

    if (!client) {
      console.log(`SSR 3: ${import.meta.env.SSR} => INCLUDE HERE THE LOGIC`)
      if (localeInfo && localeInfo.current !== i18nOptions!.defaultLocale)
        router.push({ path: `${routerOptions.base || '/'}${localeInfo.current}/` })
      else
        router.push(routerOptions.base || '/')

      await router.isReady()
      context.initialState = router.currentRoute.value.meta.state as Record<string, any> || {}
    }

    // serialize initial state for SSR app for it to be interpolated to output HTML
    const initialState = transformState?.(context.initialState) || serializeState(context.initialState)

    return {
      ...context,
      initialState,
    } as ViteSSGContext<true>
  }

  if (isClient) {
    (async() => {
      const { app, router } = await createApp(true)
      // wait until page component is fetched before mounting
      await router.isReady()
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
