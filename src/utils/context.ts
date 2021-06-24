import { Router, createRouter, createWebHistory, createMemoryHistory, RouteRecordRaw } from 'vue-router'
import { App } from 'vue'
import { HeadClient } from '@vueuse/head'
import { createI18nRouter } from '../i18n/i18nRouter'
import { CreateVueI18n, LocaleInfo, ViteSSGContext } from '../types'
import { RouterConfiguration } from './types'
import { deserializeState, serializeState } from './state'
import { configureRouterBeforeEachEntryServer } from './utils'

function createViteSSGRouter(
  app: App,
  configuration: RouterConfiguration,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
): {
    router: Router
    routes: RouteRecordRaw[]
    localeInfo?: LocaleInfo
    createVueI18n?: CreateVueI18n
    useFn?: (context: ViteSSGContext<true>) => Promise<void> | void
  } {
  const { client, routerOptions, i18n } = configuration
  let router: Router
  let routes: RouteRecordRaw[] = routerOptions.routes
  let localeInfo: LocaleInfo | undefined
  let createVueI18n: CreateVueI18n | undefined

  if (i18n) {
    ({ router, routes, fn, localeInfo, createVueI18n } = createI18nRouter(configuration, i18n, fn))
  }
  else {
    router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })
    app.use(router)
  }

  return { router, routes, useFn: fn, localeInfo, createVueI18n }
}

async function initializeState(
  app: App,
  head: HeadClient | undefined,
  isClient: boolean,
  client: boolean,
  router: Router,
  routes: RouteRecordRaw[],
  createI18n: CreateVueI18n | undefined,
  localeInfo: LocaleInfo | undefined,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteSSGContext<true>> {
  const context: ViteSSGContext<true> = { app, head, isClient, router, routes, createI18n, initialState: {} }

  if (client)
    // @ts-ignore
    context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

  await fn?.(context)

  return context
}

export async function initViteSSGContext(
  app: App,
  head: HeadClient | undefined,
  configuration: RouterConfiguration,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteSSGContext<true>> {
  const { client, i18n, isClient } = configuration

  const { router, routes, useFn, localeInfo, createVueI18n } = await createViteSSGRouter(app, configuration, fn)

  const context = await initializeState(
    app,
    head,
    isClient,
    client,
    router,
    routes,
    createVueI18n,
    localeInfo,
    useFn,
    transformState,
  )

  // i18n logic will be include on createViteSSGRouter: we only need to handle routing as the original
  if (!i18n)
    configureRouterBeforeEachEntryServer(router, context)

  if (!client) {
    if (i18n && configuration.requestHeaders?.requestUrl) {
      // noinspection ES6MissingAwait
      await router.push({ path: configuration.requestHeaders.requestUrl })
    }

    else {
      // noinspection ES6MissingAwait
      await router.push(configuration.routerOptions.base || '/')
    }

    await router.isReady()
    context.initialState = router.currentRoute.value.meta.state as Record<string, any> || {}
  }

  // serialize initial state for SSR app for it to be interpolated to output HTML
  const initialState = transformState?.(context.initialState) || serializeState(context.initialState)

  return {
    ...context,
    initialState,
  }
}
