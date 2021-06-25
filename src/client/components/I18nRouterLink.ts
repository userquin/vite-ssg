import { defineComponent, h } from 'vue'
import { RouteLocationRaw, RouterLink, useRouter } from 'vue-router'
import { injectDefaultLocale, useGlobalI18n } from '../../i18n/composables'
import { resolveNewRawLocationRoute } from '../../i18n/utils'

export const I18nRouterLink = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const defaultLocale = injectDefaultLocale()!
    const router = useRouter()
    const { locale } = useGlobalI18n()
    return () => {
      return h(RouterLink, {
        ...attrs,
        to: resolveNewRawLocationRoute(router, attrs.to as RouteLocationRaw, defaultLocale, locale.value),
      }, slots)
    }
  },
})
