import { RouterView } from 'vue-router'
import { HeadAttrs } from '@vueuse/head'
import { WritableComputedRef, isRef, readonly } from '@vue/reactivity'
import { createI18n, I18n } from 'vue-i18n'
import { inject } from 'vue'
import { CreateVueI18nFn } from '../types'
import type { I18nOptions, LocaleInfo, ViteSSGLocale, Crawling } from '../types'
import type { RouteRecordRaw } from 'vue-router'

const localesKey = Symbol('vite-ssg:languages')

export function useAvailableLocales(): Array<ViteSSGLocale> {
  return inject<Array<ViteSSGLocale>>(localesKey, [])
}

export function createI18nFactory(
  defaultLocale: string,
  localesMap: Map<string, ViteSSGLocale>,
  initialized: (i18n: I18n<Record<string, any>, unknown, unknown, false>) => void,
): CreateVueI18nFn {
  return (messagesResolver, app, localeInfo?: LocaleInfo) => {
    const fallbackLocale = defaultLocale

    // todo@userquin: maybe we can accept some options on CreateVueI18nFn and merge here
    const i18n = createI18n({
      legacy: false,
      fallbackLocale,
      messages: messagesResolver(),
      locale: localeInfo?.current || fallbackLocale,
    })

    initialized(i18n)

    app.use(i18n)

    localeInfo && app.provide(localesKey, readonly(Array.from(localesMap.values())))

    return i18n
  }
}

// https://developers.google.com/search/docs/advanced/crawling/special-tags
function addGoogleNoTranslate(crawling: Crawling) {
  // <meta name="google" content="notranslate" />
  crawling.noTranslate = {
    tag: 'meta',
    props: {
      name: 'google',
      content: 'notranslate',
    },
  }
}

// https://developers.google.com/search/docs/advanced/crawling/localized-versions
function addMetaTagsForAlternativeURLs(
  base: string,
  route: RouteRecordRaw,
  defaultLocale: string,
  locales: ViteSSGLocale[],
): Crawling {
  const crawling: Crawling = { localizedVersions: {} }
  addGoogleNoTranslate(crawling)
  locales.reduce((acc, { locale }) => {
    acc[locale] = {
      tag: 'link',
      props: {
        rel: 'alternate',
        hreflang: locale === defaultLocale ? 'x-default' : locale,
        href: locale === defaultLocale ? `${base}${route.path}` : `${base}${locale}/${route.path}`,
        key: locale,
      },
    }
    return acc
  }, crawling.localizedVersions!)
  route.meta = route.meta || {}
  route.meta.crawling = crawling
  return crawling
}

function createLocales(i18nOptions: I18nOptions): Map<string, ViteSSGLocale> {
  const locales: Record<string, string> = i18nOptions.locales || {}
  const defaultLocale = i18nOptions.defaultLocale
  return Object.keys(locales).reduce((acc, locale) => {
    const [lang, country = undefined, variant = undefined] = locale.split('-')
    acc.set(locale, {
      locale,
      description: locales[locale],
      lang,
      country,
      variant,
      to: locale === defaultLocale ? { params: { locale: '' } } : { params: { locale } },
    })
    return acc
  }, new Map<string, ViteSSGLocale>())
}

export function initializeI18n(i18n?: I18nOptions): {
  enabled: boolean
  info?: {
    localesMap: Map<string, ViteSSGLocale>
    defaultLocale: string
    localePathVariable: string
  }
} {
  if (i18n) {
    let localePathVariable = i18n.localePathVariable || 'locale'
    if (localePathVariable.startsWith('/'))
      localePathVariable = localePathVariable.substring(1)
    if (localePathVariable.startsWith(':'))
      localePathVariable = localePathVariable.substring(1)
    if (localePathVariable.endsWith('/'))
      localePathVariable = localePathVariable.substring(0, localePathVariable.length - 1)
    return {
      enabled: true,
      info: {
        localesMap: createLocales(i18n),
        defaultLocale: i18n.defaultLocale,
        localePathVariable,
      },
    }
  }
  else {
    return { enabled: false }
  }
}

export function detectClientLocale(defaultLocale: string, localesMap: Map<string, ViteSSGLocale>): LocaleInfo {
  // navigator.languages:    Chrome & FF
  // navigator.language:     Safari & Others
  // navigator.userLanguage: IE & Others
  // @ts-ignore
  const languages = navigator.languages || [navigator.language || navigator.userLanguage]

  // lookup current or use default
  const current = languages.find(l => localesMap.has(l)) || defaultLocale

  return {
    current,
    locales: Array.from(localesMap.keys()).reduce((acc, locale) => {
      acc[locale] = localesMap.get(locale)!
      return acc
    }, {} as Record<string, ViteSSGLocale>),
  }
}

function prepareHead(
  baseHref: string,
  route: RouteRecordRaw,
  defaultLocale: string,
  localesArray: Array<ViteSSGLocale>,
  localeRefResolver: () => WritableComputedRef<string> | undefined,
) {
  const crawling = addMetaTagsForAlternativeURLs(baseHref, route, defaultLocale, localesArray)
  crawling.extractAlternateUrls = () => {
    const headers: HeadAttrs[] = []
    // memory leak using localeRef here?
    if (crawling.localizedVersions) {
      const list = crawling.localizedVersions
      headers.push(...Object.keys(list).map((l) => {
        const { props: { rel, hreflang, href } } = list[l]
        return { rel, hreflang, href, key: l }
      }))
    }
    return headers
  }
  if (route.meta) {
    route.meta.injectI18nMeta = (head) => {
      head.meta = head.meta || []
      const metaArray = isRef(head.meta) ? head.meta.value : head.meta

      // 1) Meta tag for `og:locale` for the current locale
      const localeRef = localeRefResolver()
      if (localeRef) {
        metaArray.push({
          property: 'og:locale',
          content: localeRef.value,
        })
      }

      // 2) Meta tag to avoid browser showing page translation popup
      metaArray.push({
        property: 'google',
        content: 'notranslate',
      })

      // 3) link`s for alternate urls for each locale
      head.link = head.link || []
      const linkArray = isRef(head.link) ? head.link.value : head.link
      if (crawling.extractAlternateUrls)
        linkArray.push(...crawling.extractAlternateUrls())

      return head
    }
  }
}

export function buildLocaleRoute(
  routes: RouteRecordRaw[],
  localeRefResolver: () => WritableComputedRef<string> | undefined,
  localeInfo?: LocaleInfo,
  localePathVariable?: string,
  defaultLocale?: string,
  baseHref?: string,
): RouteRecordRaw[] {
  let firstTimeIntercepted = false
  const localesArray = localeInfo ? Object.values(localeInfo.locales) : undefined
  return [{
    alias: [''],
    path: `/:${localePathVariable}?`,
    component: RouterView,
    children: routes.map((r) => {
      if (r.path.startsWith('/'))
        r.path = r.path.substring(1)

      if (localesArray && baseHref && defaultLocale)
        prepareHead(baseHref, r, defaultLocale, localesArray, localeRefResolver)

      return r
    }),
    beforeEnter(to, from, next) {
      if (localePathVariable) {
        const localeParams = to.params[localePathVariable]
        const localesParam = localeParams || defaultLocale!
        const localeRef = localeRefResolver()
        if (localeRef) {
          let localeParam: string
          if (Array.isArray(localesParam))
            localeParam = localesParam[0]
          else
            localeParam = localesParam

          // check for existing locale
          if (localeInfo!.locales[localeParam]) {
            // the user enters the url (via locale selector or via url nav bar)
            // for example: default is 'en' end the user enters '/en/' on the url
            // in that case we need to keep the url
            if (localeParams || firstTimeIntercepted) {
              // just change the locale if provided
              localeRef.value = localeParam
            }
            else {
              firstTimeIntercepted = true
              if (localeInfo!.current !== defaultLocale) {
                localeRef.value = localeInfo!.current
                if (localeParam === defaultLocale)
                  next({ replace: true, path: to.path.replace('/', `/${localeInfo!.current}/`) })
                else
                  next({ replace: true, path: to.path.replace(`/${localeParam}/`, `/${localeInfo!.current}/`) })

                return
              }
            }
          }
          else {
            firstTimeIntercepted = true
            if (localeRef.value !== localeInfo!.current)
              localeRef.value = localeInfo!.current

            if (localeInfo!.current === defaultLocale)
              next({ replace: true, path: to.path.replace(`/${localeParam}/`, '/') })
            else
              next({ replace: true, path: to.path.replace(`/${localeParam}/`, `/${localeInfo!.current}/`) })

            return
          }
        }
      }
      next()
    },
  }]
}

const serverAcceptLanguageRegex = /((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;q=[0-1](\.[0-9]+)?)?)*/g

function parseAcceptLanguageHeader(al: string): Array<string> {
  const result = (al || '').match(serverAcceptLanguageRegex)
  return result === null
    ? []
    : result.map((m) => {
      if (!m)
        return undefined

      const bits = m.split(';')
      const ietf = bits[0].split('-')
      const hasScript = ietf.length === 3

      return {
        code: ietf[0],
        script: hasScript ? ietf[1] : null,
        region: hasScript ? ietf[2] : ietf[1],
        quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0,
      }
    }).filter((r) => {
      return r !== undefined
    }).sort((a, b) => {
      return b!.quality - a!.quality
    }).map(r => r!.code)
}

export function detectServerLocale(
  requestHeaders?: Record<string, any>,
  defaultLocale?: string,
  localesMap?: Map<string, ViteSSGLocale>,
): {
    localeInfo?: LocaleInfo
    baseHref?: string
  } {
  const result = {
    localeInfo: undefined,
    baseHref: undefined,
  }
  // to be removed on compile time: https://vitejs.dev/guide/ssr.html#conditional-logic
  // if (process.env.SSR === 'true' || import.meta.env.SSR) {
  // if (requestHeaders && defaultLocale && localesMap) {
  //
  // }
  // }
  return result
}
