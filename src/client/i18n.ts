import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead } from '@vueuse/head'
import { initializeI18n } from '../i18n/utils'
import { initViteI18nSSGContext } from '../i18n/i18nRouter'
import { I18nOptions, ViteI18nSSGClientOptions, ViteI18nSSGContext, RouterConfiguration } from '../i18n/types'
import { ClientOnly } from './components/ClientOnly'
import { I18nRouterLink } from './components/I18nRouterLink'
import type { RouterOptions } from '../types'

export * from '../i18n/types'

export function ViteSSG(
  App: Component,
  routerOptions: RouterOptions,
  options: ViteI18nSSGClientOptions,
  fn?: (context: ViteI18nSSGContext) => Promise<void> | void,
) {
  const {
    transformState,
    registerComponents = true,
    rootContainer = '#app',
    i18nOptions,
  } = options

  const isClient = typeof window !== 'undefined'

  async function createApp(
    client = false,
    base?: string,
    requestHeaders?: {
      acceptLanguage?: string
      requestUrl?: string
      localeCookie?: string
    },
  ) {
    let useI18nOptions: I18nOptions
    if (typeof i18nOptions === 'function')
      useI18nOptions = await i18nOptions()
    else
      useI18nOptions = i18nOptions

    const i18n = initializeI18n(useI18nOptions, base)

    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    const head = createHead()

    app.use(head)

    if (registerComponents) {
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })
      app.component('I18nRouterLink', I18nRouterLink)
    }

    const configuration: RouterConfiguration = { client, isClient, routerOptions, i18n, i18nOptions: useI18nOptions }

    if (!client && requestHeaders)
      configuration.requestHeaders = requestHeaders

    return await initViteI18nSSGContext(
      app,
      head,
      configuration,
      fn,
      transformState,
    )
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
