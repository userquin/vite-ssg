import path from 'path'
import { UserConfig } from 'vite'
import Markdown from 'vite-plugin-md'
import Pages from 'vite-plugin-pages'
import Components from 'vite-plugin-components'
import Vue from '@vitejs/plugin-vue'
import VueI18n from '@intlify/vite-plugin-vue-i18n'

const pages = new Map<string, number>()

const i18nAlternateBase = (process.env.I18N_BASE ? process.env.I18N_BASE : undefined)

const config: UserConfig = {
  resolve: {
    alias: {
      '@nuxt/devalue': '@nuxt/devalue/dist/devalue.js',
      'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
    },
  },
  // build: {
  //   manifest: !process.env.VITE_SSG,
  // },
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Pages({
      routeBlockLang: 'yaml',
      extensions: ['vue', 'md'],
    }),
    Markdown({
      headEnabled: true,
    }),
    Components({
      extensions: ['vue', 'md'],
      customLoaderMatcher: path => path.endsWith('.md'),
    }),
    // https://github.com/intlify/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      defaultSFCLang: 'yaml',
      globalSFCScope: true,
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
    i18nAlternateBase,
  },
}

export default config
