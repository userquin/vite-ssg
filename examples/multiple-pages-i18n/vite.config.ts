import path from 'path'
import { UserConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import Pages from 'vite-plugin-pages'
import Components from 'vite-plugin-components'
import Vue from '@vitejs/plugin-vue'
import VueI18n from '@intlify/vite-plugin-vue-i18n'

const config: UserConfig = {
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Pages({
      extensions: ['vue', 'md'],
    }),
    Markdown({
      headEnabled: true,
    }),
    Components({
      customLoaderMatcher: path => path.endsWith('.md'),
    }),
    // https://github.com/intlify/vite-plugin-vue-i18n
    VueI18n({
      include: [path.resolve(__dirname, 'locales/**')],
    }),

  ],
  ssgOptions: {
    script: 'async',
    formatting: 'prettify',
    i18nOptions: {
      defaultLocale: 'en',
      locales: {
        en: 'English',
        es: 'Español',
      },
    },
  },
}

export default config
