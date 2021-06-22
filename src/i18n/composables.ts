import { RouteLocationNormalizedLoaded, useRoute } from 'vue-router'
import { App, computed, inject, onBeforeUnmount, ref, watchEffect } from 'vue'
import { Locale, useI18n } from 'vue-i18n'
import { HeadObject, useHead } from '@vueuse/head'
import { WatchStopHandle } from '@vue/runtime-core'
import { readonly } from '@vue/reactivity'
import { AvailableLocale, ViteSSGLocale } from './types'
import type { Ref } from 'vue'

const localesKey = Symbol('vite-ssg:languages')
const defaultLocaleKey = Symbol('vite-ssg:default-locale')
const headObjectKey = Symbol('vite-ssg:heade-object')

export function provideLocales(app: App, locales: Array<ViteSSGLocale>) {
  app.provide(localesKey, readonly(locales))
}

export function provideDefaultLocale(app: App, defaultLocale: ViteSSGLocale) {
  app.provide(defaultLocaleKey, defaultLocale)
}

export function injectDefaultLocale() {
  return inject<ViteSSGLocale>(defaultLocaleKey)
}

export function provideHeadObject(app: App, headObject: Ref<HeadObject>) {
  app.provide(headObjectKey, headObject)
}

export function injectHeadObject() {
  return inject<Ref<HeadObject>>(headObjectKey)
}

export function useAvailableLocales() {
  const route = useRoute()
  const defaultLocale = inject<ViteSSGLocale>(defaultLocaleKey)!.locale
  const locales = inject<Array<ViteSSGLocale>>(localesKey, [])
  const availableLocales = computed<Array<AvailableLocale>>(() => {
    const currentLocale = route.params.locale
    const rawPath = route.meta.rawPath!
    return locales.map(({ locale, description }) => {
      return {
        locale,
        description,
        current: currentLocale === locale,
        to: {
          force: false,
          path: defaultLocale === locale ? `/${rawPath}` : `/${locale}/${rawPath}`,
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
