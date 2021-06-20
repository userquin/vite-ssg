// https://developers.google.com/search/docs/advanced/crawling/special-tags
import { isRef, WritableComputedRef } from '@vue/reactivity'
import type { RouteRecordRaw } from 'vue-router'
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
  route: RouteRecordRaw,
  defaultLocale: string,
  locales: ViteSSGLocale[],
  base?: string,
): Crawling {
  const crawling: Crawling = { }
  addGoogleNoTranslate(crawling)
  if (base) {
    crawling.localizedVersions = {}
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
  }

  route.meta = route.meta || {}
  route.meta.crawling = crawling
  return crawling
}

export function prepareHead(
  route: RouteRecordRaw,
  defaultLocale: string,
  localesArray: Array<ViteSSGLocale>,
  localeRef: WritableComputedRef<string>,
  base?: string,
) {
  const crawling = addMetaTagsForAlternativeURLs(route, defaultLocale, localesArray, base)
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
    route.meta.injectI18nMeta = (head) => {
      head.meta = head.meta || []
      const metaArray = isRef(head.meta) ? head.meta.value : head.meta

      // 1) `lang` attribute for `html` element
      head.htmlAttrs = {
        lang: localeRef.value,
      }
      // 2) Meta tag for `og:locale` for the current locale
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

      // 2) Meta tag to avoid browser showing page translation popup
      if (metaArray.find(m => m.property === 'google') === null) {
        metaArray.push({
          property: 'google',
          content: 'notranslate',
        })
      }

      // 3) link`s for alternate urls for each locale
      // todo@userquin: avoid duplicate entries
      head.link = head.link || []
      const linkArray = isRef(head.link) ? head.link.value : head.link
      if (crawling.extractAlternateUrls)
        linkArray.push(...crawling.extractAlternateUrls())

      return head
    }
  }
}
