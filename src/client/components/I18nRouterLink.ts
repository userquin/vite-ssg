import { defineComponent, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouteLocationRaw, RouterLink, useRouter } from 'vue-router'
import { injectDefaultLocale } from '../../i18n/composables'
import { resolveNewRawLocationRoute } from '../../i18n/utils'

export const I18nRouterLink = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const defaultLocale = injectDefaultLocale()!
    const router = useRouter()
    const { locale } = useI18n({ useScope: 'global' })
    return () => {
      return h(RouterLink, {
        to: resolveNewRawLocationRoute(router, attrs.to as RouteLocationRaw, defaultLocale, locale.value),
      }, slots)
    }
  },
})
