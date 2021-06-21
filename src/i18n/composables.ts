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

// async function createHeadObject(headObject: HeadObject, route: RouteLocationNormalizedLoaded): Promise<HeadObject> {
//   route.meta?.injectI18nMeta?.(headObject)
//   return headObject
// }

// todo@userquin: https://github.com/intlify/vue-i18n-next/tree/master/examples/lazy-loading/vite/src
// export function useI18nHead(resolver: I18nHeadResolver) {
//   const { locale } = useI18n({ useScope: 'global' })
//   const { locales, route } = useAvailableLocales()
//   const defaultLocale = inject<ViteSSGLocale>(defaultLocaleKey)
//   const headObjectRef = ref<HeadObject>({})
//
//   useHead(headObjectRef)
//
//   const cache = new Map<string, Map<string, HeadObject>>()
//
//   const updateHead = (
//     path: string,
//     locale: string,
//     headObject: HeadObject,
//     cacheEntry?: Map<string, HeadObject>,
//   ) => {
//     if (!cacheEntry) {
//       cacheEntry = new Map<string, HeadObject>()
//       cache.set(path, cacheEntry)
//     }
//     cacheEntry.set(locale, headObject)
//     console.log('PASO2!!!')
//     headObjectRef.value = headObject as any
//   }
//
//   const reloadHead = async(currentLocale: string | string[]) => {
//     const localeParam = (Array.isArray(currentLocale) ? currentLocale[0] : currentLocale) || defaultLocale
//     const ssgLocale = (localeParam ? locales.find(l => l.locale === localeParam) : defaultLocale) || defaultLocale!
//     const path = route.path
//     const cacheEntry = cache.get(path)
//     const localeEntry = cacheEntry?.get(ssgLocale.locale)
//     if (localeEntry) {
//       headObjectRef.value = localeEntry as any
//     }
//     else {
//       let headObject: HeadObject
//       if (typeof resolver === 'function')
//         headObject = await resolver(ssgLocale)
//
//       else
//         headObject = resolver || {}
//
//       headObject = await createHeadObject(headObject, route)
//       updateHead(
//         path,
//         ssgLocale.locale,
//         headObject,
//         cacheEntry,
//       )
//     }
//   }
//
//   const stops: WatchStopHandle[] = [/* () => {
//     head.removeHeadObjs(headObjectRef as Ref<HeadObjectPlain>)
//     head.updateDOM(document)
//   } */]
//
//   stops.push(watchEffect(() => {
//     const currentLocale = route.params.locale
//     console.log('PASO!!!')
//     reloadHead(currentLocale).catch((e) => {
//       console.error('there was an error while updating head', e)
//     })
//   }, { flush: 'post' }))
//
//   // if (window !== undefined) {
//   //   stops.push(
//   //     watchEffect(() => {
//   //       head.updateDOM(document)
//   //     }),
//   //   )
//   // }
//
//   onBeforeUnmount(() => {
//     stops.forEach(stop => stop())
//   })
// }
