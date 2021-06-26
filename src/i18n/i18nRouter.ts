import { createI18n, I18n } from 'vue-i18n'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  RouterView,
} from 'vue-router'
import { App, defineComponent, h, nextTick, Ref, ref } from 'vue'
import { HeadClient, HeadObject, HeadObjectPlain } from '@vueuse/head'
import { deserializeState, serializeState } from '../utils/state'
import { ViteSSGLocale } from '../../i18n'
import {
  LocaleInfo,
  ViteI18nSSGContext,
} from './types'
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
import type { Router } from 'vue-router'
import type { RouterConfiguration } from './types'

async function createI18nRouter(
  app: App,
  head: HeadClient,
  configuration: RouterConfiguration,
  fn?: (context: ViteI18nSSGContext) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<{
    router: Router
    context: ViteI18nSSGContext
  }> {
  const { client, isClient, routerOptions, i18n: i18nConfiguration, i18nOptions, requestHeaders } = configuration

  let localeInfo: LocaleInfo
  // eslint-disable-next-line prefer-const
  let { routes, ...useRouterOptions } = routerOptions

  const {
    localesMap,
    defaultLocale,
    defaultLocaleOnUrl,
    localePathVariable,
    cookieName,
  } = i18nConfiguration

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
    base = i18nConfiguration.base

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
      r.meta.pageI18nKey = `/${routeName}`
    }

    if (!r.meta.titleKey)
      r.meta.titleKey = `${r.meta.pageI18nKey}.title`

    if (!r.meta.descriptionKey)
      r.meta.descriptionKey = `${r.meta.pageI18nKey}.description`

    if (!r.meta.imageKey)
      r.meta.imageKey = `${r.meta.pageI18nKey}.image`

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

  const availableLocales = Array.from(localesMap.values())

  const {
    routeMessages,
    headConfigurer,
    ssgHeadConfigurer,
  } = i18nOptions

  const globalMessages = await i18nOptions.globalMessages?.()

  console.log(globalMessages)

  // todo@userquin: maybe we can accept some options on CreateVueI18nFn and merge here
  // todo@userquin: review also globalInjection argument
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    fallbackLocale: defaultLocale,
    availableLocales: availableLocales.map(l => l.locale),
    messages: globalMessages || {},
    locale: localeInfo.current,
  })

  // create the router
  const router = createRouter({
    history: client
      ? createWebHistory(routerOptions.base)
      : createMemoryHistory(routerOptions.base),
    ...useRouterOptions,
    routes: localeRoutes,
  })

  const localeRef = i18n.global.locale
  const localesArray = Object.values(localeInfo.locales)
  const headObject = ref<HeadObject>({}) as Ref<HeadObjectPlain>

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

  const locales = Array.from(localesMap.values())
  // provide some helpers
  provideLocales(app, locales)
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

  localeRef.value = localeInfo.current

  await nextTick()

  const context = await initializeState(
    app,
    head,
    isClient,
    client,
    router,
    localeRoutes,
    defaultLocale,
    locales,
    requiresMapDefaultLocale,
    localePathVariable,
    i18n,
    fn,
    transformState,
  )

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
      routeMessages,
      headConfigurer,
    )
  }
  else {
    await configureRouteEntryServer(
      requestHeaders?.requestUrl || routerOptions.base || '/',
      router,
      context,
      headObject,
      defaultViteSSGLocale,
      localesMap,
      localesMap.get(localeInfo.current)!,
      i18n,
      globalMessages,
      routeMessages,
      headConfigurer,
      ssgHeadConfigurer,
    )
  }

  // return i18n stuff
  return { router, context }
}

async function initializeState(
  app: App,
  head: HeadClient,
  isClient: boolean,
  client: boolean,
  router: Router,
  routes: RouteRecordRaw[],
  defaultLocale: string,
  locales: ViteSSGLocale[],
  defaultLocaleOnUrl: boolean,
  localePathVariable: string,
  i18n: I18n<Record<string, any>, unknown, unknown, false>,
  fn?: (context: ViteI18nSSGContext) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteI18nSSGContext> {
  const context: ViteI18nSSGContext = {
    app,
    head,
    isClient,
    router,
    routes,
    locales,
    defaultLocale,
    defaultLocaleOnUrl,
    localePathVariable,
    i18n,
    initialState: {},
  }

  if (client)
  // @ts-ignore
    context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

  await fn?.(context)

  return context
}

export async function initViteI18nSSGContext(
  app: App,
  head: HeadClient,
  configuration: RouterConfiguration,
  fn?: (context: ViteI18nSSGContext) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteI18nSSGContext> {
  const { client, i18n } = configuration

  const { router, context } = await createI18nRouter(app, head, configuration, fn, transformState)

  if (!client) {
    if (i18n && configuration.requestHeaders?.requestUrl)
      router.push({ path: configuration.requestHeaders.requestUrl })

    else
      router.push(configuration.routerOptions.base || '/')

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
