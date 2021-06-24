import path from 'path'
import { UserConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import Pages from 'vite-plugin-pages'
import Components from 'vite-plugin-components'
import Vue from '@vitejs/plugin-vue'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import i18nOptions from './ssg-i18n-options.json'

const pages = new Map<string, number>()

const config: UserConfig = {
  build: {
    manifest: !process.env.VITE_SSG,
  },
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
      include: [
        path.resolve(__dirname, 'locales/**'),
        path.resolve(__dirname, 'locales/pages/**'),
        path.resolve(__dirname, 'src/pages/**'),
      ],
    }),

  ],
  ssgOptions: {
    script: 'async',
    formatting: 'prettify',
    onBeforePageRender(route, indexHtml) {
      pages.set(route, Date.now())
      return indexHtml
    },
    onPageRendered(route, renderedHTML) {
      pages.set(route, Date.now() - pages.get(route)!)
      return renderedHTML
    },
    onFinished() {
      pages.forEach((t, r) => {
        console.log(`${r} took: ${t}ms`)
      })
      console.log('FINISHED')
    },
    i18nOptions() {
      if (process.env.I18N_BASE)
        (i18nOptions as any).base = process.env.I18N_BASE

      return i18nOptions
    },
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-i18n',
      'vue-router',
    ],
  },
}

export default config
