import { createSSRApp, Component, createApp as createClientApp } from 'vue'
import { createHead } from '@vueuse/head'
import { initializeI18n } from '../i18n/utils'
import { initViteSSGContext } from '../utils/context'
import { ClientOnly } from './components/ClientOnly'
import { I18nRouterLink } from './components/I18nRouterLink'
import type { RouterConfiguration } from '../utils/types'
import type { HeadClient } from '@vueuse/head'
import type { ViteSSGContext, ViteSSGClientOptions, RouterOptions } from '../types'

export * from '../types'

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

  async function createApp(
    client = false,
    base?: string,
    requestHeaders?: {
      acceptLanguage?: string
      requestUrl?: string
      localeCookie?: string
    },
  ) {
    const i18nInfo = initializeI18n(base, i18nOptions)

    const app = client
      ? createClientApp(App)
      : createSSRApp(App)

    let head: HeadClient | undefined

    if (useHead || i18nOptions) {
      head = createHead()
      app.use(head)
    }

    if (registerComponents) {
      app.component('ClientOnly', client ? ClientOnly : { render: () => null })
      if (i18nInfo)
        app.component('I18nRouterLink', I18nRouterLink)
    }

    const configuration: RouterConfiguration = { client, isClient, routerOptions }

    if (!client && requestHeaders)
      configuration.requestHeaders = requestHeaders

    if (i18nInfo.info)
      configuration.i18n = i18nInfo.info

    return await initViteSSGContext(
      app,
      head,
      isClient,
      configuration,
      fn,
      transformState,
    )
  }

  if (isClient) {
    (async() => {
      const { app, router } = await createApp(true)
      await router.isReady()
      app.mount(rootContainer, true)
    })()
  }

  return createApp
}
