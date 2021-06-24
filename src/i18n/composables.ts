import {
  Router,
  useRoute,
  useRouter,
} from 'vue-router'
import { App, computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { HeadObjectPlain } from '@vueuse/head'
import { readonly } from '@vue/reactivity'
import { AvailableLocale, DefaultViteSSGLocale, ViteSSGLocale } from './types'
import { resolveNewRawLocationRoute, resolveNewRouteLocationNormalized } from './utils'
import type { Ref } from 'vue'

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

export function useI18nRouter() {
  const router = useRouter()
  const { locale } = useI18n({ useScope: 'global' })
  const defaultLocale = injectDefaultLocale()
  if (defaultLocale) {
    const i18nRouter: Router = {
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
    }
    return i18nRouter
  }
  return router
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
