import { defineComponent, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { LocationAsPath, RouteLocationRaw, RouterLink, RouterLinkProps } from 'vue-router'
import { injectDefaultLocale } from '../../i18n/composables'

export const I18nRouterLink = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const { locale } = useI18n({ useScope: 'global' })
    const defaultLocale = injectDefaultLocale()!
    return () => {
      let to: string | LocationAsPath = attrs.to as any

      if (locale.value !== defaultLocale.locale) {
        if (typeof to === 'string')
          to = `/${locale.value}/${to.startsWith('/') ? to.substring(1) : to}`
        else
          to.path = `/${locale.value}/${to.path.startsWith('/') ? to.path.substring(1) : to.path}`
      }

      return h(RouterLink, { ...attrs, to }, slots)
    }
  },
})
