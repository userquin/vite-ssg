import { Router, useRoute, useRouter } from 'vue-router'
import { App, computed, inject, onBeforeMount, onBeforeUnmount } from 'vue'
import { Locale, useI18n } from 'vue-i18n'
import { isRef, readonly, WritableComputedRef } from '@vue/reactivity'
import { AvailableLocale, DefaultViteSSGLocale, ViteSSGLocale } from './types'
import { resolveNewRawLocationRoute, resolveNewRouteLocationNormalized } from './utils'
import type { Ref } from 'vue'
import type { HeadObject, HeadObjectPlain } from '@vueuse/head'

const localesKey = Symbol('vite-ssg:locales')
const defaultLocaleKey = Symbol('vite-ssg:default-locale')
const headObjectKey = Symbol('vite-ssg:head-object')

export function provideLocales(app: App, locales: Array<ViteSSGLocale>) {
  app.provide(localesKey, readonly(locales))
}

export function provideDefaultLocale(app: App, defaultLocale: DefaultViteSSGLocale) {
  app.provide(defaultLocaleKey, defaultLocale)
}

export function injectDefaultLocale() {
  return inject<DefaultViteSSGLocale>(defaultLocaleKey)
}

export function injectLocales(): ViteSSGLocale[] {
  return inject<Array<ViteSSGLocale>>(localesKey, [])
}

export function provideHeadObject(app: App, headObject: Ref<HeadObjectPlain>) {
  app.provide(headObjectKey, headObject)
}

export function injectHeadObject() {
  return inject<HeadObjectPlain>(headObjectKey)
}

export function useGlobalI18n() {
  return useI18n({ useScope: 'global' })
}

export function initializeHead(head: HeadObject) {
  if (head.meta) {
    if (isRef(head.meta))
      head.meta.value = []

    else
      head.meta = []
  }
  if (head.link) {
    if (isRef(head.link))
      head.link.value = []

    else
      head.link = []
  }
  if (head.style) {
    if (isRef(head.style))
      head.style.value = []

    else
      head.style = []
  }
  if (head.htmlAttrs) {
    if (isRef(head.htmlAttrs))
      head.htmlAttrs.value = []

    else
      head.htmlAttrs = []
  }
  if (head.bodyAttrs) {
    if (isRef(head.bodyAttrs))
      head.bodyAttrs.value = []

    else
      head.bodyAttrs = []
  }
}

export function addMetaHeadName(name: string, content: string, head: HeadObject) {
  head.meta = head.meta || []
  const metaArray = isRef(head.meta) ? head.meta.value : head.meta
  const idx = metaArray.findIndex(m => m.name === name)
  if (idx >= 0)
    metaArray.splice(idx, 1)
  metaArray.push({
    name,
    content,
  })
}

export function addMetaHeadProperty(property: string, content: string, head: HeadObject) {
  head.meta = head.meta || []
  const metaArray = isRef(head.meta) ? head.meta.value : head.meta
  const idx = metaArray.findIndex(m => m.property === property)
  if (idx >= 0)
    metaArray.splice(idx, 1)
  metaArray.push({
    property,
    content,
  })
}

export type CustomHeadHandler = (head: HeadObject) => void

export type I18nRouter = Router & {
  registerHeadHandler?: (key: string, handler: CustomHeadHandler) => void
  unRegisterHeadHandler?: (key: string, handler: CustomHeadHandler) => void
  notifyHeadHandler?: (key: string, head: HeadObject) => void
}

const sfcHeadHandlers = new Map<string, CustomHeadHandler>()

export function newI18nRouter(router: Router, locale: WritableComputedRef<Locale>, defaultLocale?: DefaultViteSSGLocale): I18nRouter {
  if (defaultLocale) {
    return {
      currentRoute: router.currentRoute,
      options: router.options,
      back: router.back,
      beforeEach: router.beforeEach,
      beforeResolve: router.beforeResolve,
      go: router.go,
      removeRoute: router.removeRoute,
      addRoute: router.addRoute,
      afterEach: router.afterEach,
      getRoutes: router.getRoutes,
      install: router.install,
      isReady: router.isReady,
      forward: router.forward,
      onError: router.onError,
      hasRoute: router.hasRoute,
      replace(to) {
        return router.replace(resolveNewRawLocationRoute(router, to, defaultLocale, locale.value))
      },
      push(to) {
        return router.push(resolveNewRawLocationRoute(router, to, defaultLocale, locale.value))
      },
      resolve(to, currentLocation) {
        return resolveNewRouteLocationNormalized(router, defaultLocale, locale.value, currentLocation)
      },
      registerHeadHandler(key, headHandler: CustomHeadHandler) {
        sfcHeadHandlers.set(key, headHandler)
      },
      unRegisterHeadHandler(key: string) {
        sfcHeadHandlers.delete(key)
      },
      notifyHeadHandler(key: string, head: HeadObject): void {
        if (process.env.VITE_SSG) {
          try {
            sfcHeadHandlers.get(key)?.(head)
          }
          finally {
            sfcHeadHandlers.delete(key)
          }
        }
        else {
          sfcHeadHandlers.get(key)?.(head)
        }
      },
    }
  }
  return router
}

export function useI18nRouter(): I18nRouter {
  const router = useRouter()
  const { locale } = useGlobalI18n()
  const defaultLocale = injectDefaultLocale()
  return newI18nRouter(router, locale, defaultLocale)
}

export function registerCustomHeadHandler(customHeadHandlers: CustomHeadHandler, i18nRouter?: I18nRouter) {
  const router = i18nRouter || useI18nRouter()
  if (process.env.VITE_SSG) {
    router.registerHeadHandler?.(router.currentRoute.value.fullPath, customHeadHandlers)
  }
  else {
    onBeforeMount(() => {
      router.registerHeadHandler?.(router.currentRoute.value.fullPath, customHeadHandlers)
    })
  }
}

export function useAvailableLocales() {
  const route = useRoute()
  const router = useRouter()
  const defaultLocale = injectDefaultLocale()!
  const locales = injectLocales()
  const availableLocales = computed<Array<AvailableLocale>>(() => {
    const currentLocale = route.params.locale || defaultLocale.locale
    return locales.map(({ locale, description }) => {
      const resolved = resolveNewRouteLocationNormalized(router, defaultLocale, locale)
      return {
        locale,
        description,
        current: currentLocale === locale,
        to: {
          force: false,
          path: resolved.fullPath === ''
            ? defaultLocale.path || '/'
            : resolved.fullPath,
        },
      }
    })
  })
  return {
    locales,
    availableLocales,
    route,
  }
}
