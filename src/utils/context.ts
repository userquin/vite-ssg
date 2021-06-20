import { Router, createRouter, createWebHistory, createMemoryHistory, RouteRecordRaw } from 'vue-router'
import { App } from 'vue'
import { HeadClient } from '@vueuse/head'
import { createI18nRouter } from '../i18n/i18nRouter'
import { CreateVueI18n, LocaleInfo, ViteSSGContext } from '../types'
import { RouterConfiguration } from './types'
import { deserializeState, serializeState } from './state'

function createViteSSGRouter(
  app: App,
  configuration: RouterConfiguration,
): [Router, RouteRecordRaw[], LocaleInfo | undefined, CreateVueI18n | undefined] {
  const { client, routerOptions, i18n } = configuration
  let router: Router
  let routes: RouteRecordRaw[] = routerOptions.routes
  let localeInfo: LocaleInfo | undefined
  let createVueI18n: CreateVueI18n | undefined
  if (i18n) {
    [router, routes, localeInfo, createVueI18n] = createI18nRouter(configuration, i18n)
  }
  else {
    router = createRouter({
      history: client
        ? createWebHistory(routerOptions.base)
        : createMemoryHistory(routerOptions.base),
      ...routerOptions,
    })
  }

  app.use(router)

  return [router, routes, localeInfo, createVueI18n]
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
  isClient: boolean,
  configuration: RouterConfiguration,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteSSGContext<true>> {
  const { client, i18n } = configuration

  const [router, routes, localeInfo, createI18n] = createViteSSGRouter(app, configuration)

  const context = await initializeState(
    app,
    head,
    isClient,
    client,
    router,
    routes,
    createI18n,
    localeInfo,
    fn,
    transformState,
  )

  if (!i18n) {
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
  }

  if (!client) {
    if (i18n) {
      if (localeInfo && localeInfo.current !== i18n.defaultLocale)
        router.push({ path: `${configuration.routerOptions.base || '/'}${localeInfo.current}/` })
      else
        router.push(configuration.routerOptions.base || '/')
    }
    else {
      router.push(configuration.routerOptions.base || '/')
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
