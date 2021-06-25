// https://developers.google.com/search/docs/advanced/crawling/special-tags
import { isRef, WritableComputedRef } from '@vue/reactivity'
import { RouterOptions } from '../types'
import type { Router, RouteRecordRaw } from 'vue-router'
import type { HeadAttrs, HeadObject } from '@vueuse/head'
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

function updateMetaHead(head: HeadObject, metaArray: HeadAttrs[], title?: string, description?: string, image?: string) {
  let idx = metaArray.findIndex(m => m.property === 'og:title')
  if (idx >= 0)
    metaArray.splice(idx, 1)

  idx = metaArray.findIndex(m => m.name === 'description')
  if (idx >= 0)
    metaArray.splice(idx, 1)

  idx = metaArray.findIndex(m => m.property === 'og:description')
  if (idx >= 0)
    metaArray.splice(idx, 1)

  idx = metaArray.findIndex(m => m.property === 'og:image')
  if (idx >= 0)
    metaArray.splice(idx, 1)

  idx = metaArray.findIndex(m => m.property === 'twitter:card')
  if (idx >= 0)
    metaArray.splice(idx, 1)

  if (title) {
    head.title = title
    metaArray.push({
      property: 'og:title',
      content: title,
    })
  }

  if (description) {
    metaArray.push({
      name: 'description',
      content: description,
    })
    metaArray.push({
      property: 'og:description',
      content: description,
    })
  }

  if (image) {
    metaArray.push({
      property: 'og:image',
      content: image,
    })
    metaArray.push({
      property: 'twitter:card',
      content: 'summary_large_image',
    })
  }
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
      image,
    ) => {
      head.meta = head.meta || []
      const metaArray = isRef(head.meta) ? head.meta.value : head.meta
      const { titleKey, descriptionKey, imageKey } = route.meta || {}

      let params: Record<string, any> = {}
      const useRoute = router.currentRoute.value
      if (useRoute && Object.keys(useRoute.params).length > 0)
        params = useRoute.params

      let useTitle = title
      if (!useTitle && titleKey) {
        useTitle = translate(titleKey, params)
        if (useTitle && titleKey === useTitle)
          useTitle = undefined
      }

      let useDescription = description
      if (!useDescription && descriptionKey) {
        useDescription = translate(descriptionKey, params)
        if (useDescription && descriptionKey === useDescription)
          useDescription = undefined
      }

      let useImage = image
      if (!useImage && imageKey) {
        useImage = translate(imageKey)
        if (useImage && imageKey === useImage)
          useImage = undefined
      }

      updateMetaHead(head, metaArray, useTitle, useDescription, useImage)

      return head
    }
    route.meta.injectI18nMeta = (
      head,
      locale,
      i18nComposer,
      title,
      description,
      image,
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

      let params: Record<string, any> = {}

      const useRoute = router.currentRoute.value
      if (useRoute && Object.keys(useRoute.params).length > 0)
        params = useRoute.params

      const titleText = title || (route.meta!.titleKey && i18nComposer.te(route.meta!.titleKey)
        ? i18nComposer.t(route.meta!.titleKey, params)
        : undefined)

      const descriptionText = description || (route.meta!.descriptionKey && i18nComposer.te(route.meta!.descriptionKey)
        ? i18nComposer.t(route.meta!.descriptionKey, params)
        : undefined)

      const imageText = image || (route.meta!.imageKey && i18nComposer.te(route.meta!.imageKey)
        ? i18nComposer.t(route.meta!.imageKey)
        : undefined)

      updateMetaHead(head, metaArray, titleText, descriptionText, imageText)

      // 6) link`s for alternate urls for each locale
      if (!head.link && crawling.extractAlternateUrls)
        head.link = crawling.extractAlternateUrls()

      return head
    }
  }
}
