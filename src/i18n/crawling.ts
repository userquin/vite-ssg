// https://developers.google.com/search/docs/advanced/crawling/special-tags
import { isRef, WritableComputedRef } from '@vue/reactivity'
import { RouterOptions } from '../types'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import type { HeadAttrs } from '@vueuse/head'
import type { Crawling, ViteSSGLocale } from './types'

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
  routerOptions: RouterOptions,
  route: RouteRecordRaw,
  defaultLocale: string,
  locales: ViteSSGLocale[],
  base?: string,
): Crawling {
  const crawling: Crawling = { }
  addGoogleNoTranslate(crawling)
  crawling.localizedVersions = {}
  // localized versions shouldn't be relative
  // https://developers.google.com/search/docs/advanced/crawling/localized-versions#all-method-guidelines
  // - Each language version must list itself as well as all other language versions.
  // - Alternate URLs must be fully-qualified, including the transport method (http/https), so:
  //   https://example.com/foo, not //example.com/foo or /foo
  if (!base) {
    base = routerOptions.base || '/'
    console.warn('vite-ssg:crawling: see https://developers.google.com/search/docs/advanced/crawling/localized-versions#all-method-guidelines!!!')
    console.warn('vite-ssg:crawling: ☝️ provide a base on configuration options for alternate urls, should include also transport (http/https)')
  }
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

export function prepareHead(
  routerOptions: RouterOptions,
  route: RouteRecordRaw,
  defaultLocale: string,
  localesArray: Array<ViteSSGLocale>,
  localeRef: WritableComputedRef<string>,
  base?: string,
) {
  const crawling = addMetaTagsForAlternativeURLs(routerOptions, route, defaultLocale, localesArray, base)
  crawling.extractAlternateUrls = () => {
    const headers: HeadAttrs[] = []
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
    route.meta.injectI18nMeta = (head, newRoute: RouteLocationNormalized) => {
      head.meta = head.meta || []
      const metaArray = isRef(head.meta) ? head.meta.value : head.meta

      // 1) `lang` attribute for `html` element
      head.htmlAttrs = {
        lang: localeRef.value,
      }
      const routeMeta = newRoute.meta
      if (routeMeta) {
        // 2) title
        if (routeMeta.title)
          head.title = routeMeta.title
        // 3) description
        if (routeMeta.description) {
          let description = metaArray.find(m => m.name === 'description')
          if (!description) {
            description = {
              name: 'description',
              content: localeRef.value,
            }
            metaArray.push(description)
          }
          else {
            description.content = routeMeta.description
          }
        }
      }

      // 4) Meta tag for `og:locale` for the current locale
      let ogLocale = metaArray.find(m => m.property === 'og:locale')
      if (!ogLocale) {
        ogLocale = {
          property: 'og:locale',
          content: localeRef.value,
        }
        metaArray.push(ogLocale)
      }
      else {
        ogLocale.content = localeRef.value
      }

      // 5) Meta tag to avoid browser showing page translation popup
      if (metaArray.find(m => m.property === 'google') === null) {
        metaArray.push({
          property: 'google',
          content: 'notranslate',
        })
      }

      // 6) link`s for alternate urls for each locale
      if (!head.link && crawling.extractAlternateUrls)
        head.link = crawling.extractAlternateUrls()

      return head
    }
  }
}
