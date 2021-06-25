// https://developers.google.com/search/docs/advanced/crawling/special-tags
import { isRef, WritableComputedRef } from '@vue/reactivity'
import { RouterOptions } from '../types'
import type { Router, RouteRecordRaw } from 'vue-router'
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
  if (!base.endsWith('/'))
    base += '/'

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
  router: Router,
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
    route.meta.injectI18nSSGData = (
      head,
      locale,
      translate,
      title,
      description,
    ) => {
      head.meta = head.meta || []
      const { titleKey, descriptionKey } = route.meta || {}
      if (title) {
        head.title = title
      }
      else if (titleKey) {
        const title = translate(titleKey)
        if (title && titleKey !== title)
          head.title = title
      }

      const metaArray = isRef(head.meta) ? head.meta.value : head.meta
      const descriptionIdx = metaArray.findIndex(m => m.name === 'description')
      if (descriptionIdx >= 0)
        metaArray.splice(descriptionIdx, 1)

      let useDescription = description
      if (!useDescription && descriptionKey) {
        useDescription = translate(descriptionKey)
        if (useDescription && descriptionKey === useDescription)
          useDescription = undefined
      }
      if (useDescription) {
        metaArray.push({
          name: 'description',
          content: useDescription,
        })
      }
      return head
    }
    route.meta.injectI18nMeta = (
      head,
      locale,
      i18nComposer,
      title?: string,
      description?: string,
    ) => {
      head.meta = head.meta || []
      const metaArray = isRef(head.meta) ? head.meta.value : head.meta

      // 1) `lang` attribute for `html` element
      if (head.htmlAttrs) {
        head.htmlAttrs = {
          ...head.htmlAttrs,
          lang: locale.locale,
        }
      }
      else {
        head.htmlAttrs = {
          lang: locale.locale,
        }
      }

      const isGlobal = route.meta!.isGlobal

      if (isGlobal) {
        let params: Record<string, any> = {}
        const route = router.currentRoute.value
        if (route && Object.keys(route.params).length > 0)
          params = route.params

        // 2) title
        const titleText = title || (route.meta!.titleKey && i18nComposer.te(route.meta!.titleKey)
          ? i18nComposer.t(route.meta!.titleKey, params)
          : null)
        if (titleText)
          head.title = titleText

        // 3) description
        const descriptionText = description || (route.meta!.descriptionKey && i18nComposer.te(route.meta!.descriptionKey)
          ? i18nComposer.t(route.meta!.descriptionKey, params)
          : null)

        const descriptionIdx = metaArray.findIndex(m => m.name === 'description')
        if (descriptionIdx >= 0)
          metaArray.splice(descriptionIdx, 1)

        if (descriptionText) {
          metaArray.push({
            name: 'description',
            content: descriptionText,
          })
        }
      }

      // 4) Meta tag for `og:locale` for the current locale
      const ogLocaleIdx = metaArray.findIndex(m => m.property === 'og:locale')

      if (ogLocaleIdx >= 0)
        metaArray.splice(ogLocaleIdx, 1)

      metaArray.push({
        property: 'og:locale',
        content: locale.locale,
      })

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
