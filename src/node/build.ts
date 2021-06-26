/* eslint-disable no-console */
import path, { join, dirname } from 'path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild, normalizePath, resolveConfig, UserConfig } from 'vite'
import { renderToString, SSRContext } from '@vue/server-renderer'
import { JSDOM, VirtualConsole } from 'jsdom'
import { RollupOutput } from 'rollup'
import { nextTick } from 'vue'
import { ViteSSGContext, ViteSSGOptions } from '../client'
import { createLocalePathRoute } from '../i18n/utils'
import { ViteSSGLocale } from '../i18n/types'
import { renderPreloadLinks } from './preload-links'
import { buildLog, routesToPaths, getSize } from './utils'

export interface Manifest {
  [key: string]: string[]
}

function DefaultIncludedRoutes(paths: string[]) {
  // ignore dynamic routes
  return paths.filter(i => !i.includes(':') && !i.includes('*'))
}

function extractI18nOptions(context: ViteSSGContext<true> | ViteSSGContext<false>): {
  defaultLocale: string
  locales: ViteSSGLocale[]
  defaultLocaleOnUrl: boolean
  localePathVariable: string
} | undefined {
  const i18nContext = context as any
  if (context.router && i18nContext.locales) {
    return {
      defaultLocale: i18nContext.defaultLocale,
      locales: i18nContext.locales,
      defaultLocaleOnUrl: i18nContext.defaultLocaleOnUrl as boolean,
      localePathVariable: i18nContext.localePathVariable as string,
    }
  }
  return undefined
}

async function applyI18nSSG(context: ViteSSGContext<true> | ViteSSGContext<false>) {
  if (context.router) {
    const i18nContext = context as any
    if (i18nContext.injectI18nSSG) {
      await nextTick()
      await i18nContext.injectI18nSSG()
    }
  }
}

export async function build(cliOptions: Partial<ViteSSGOptions> = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || 'production'
  const config = await resolveConfig({}, 'build', mode)

  const cwd = process.cwd()
  const root = config.root || cwd
  const ssgOut = join(root, '.vite-ssg-temp')
  const outDir = config.build.outDir || 'dist'
  const out = join(root, outDir)

  const mergedOptions: ViteSSGOptions = Object.assign({}, config.ssgOptions || {}, cliOptions)

  const {
    script = 'sync',
    mock = false,
    entry = await detectEntry(root),
    formatting = null,
    includedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
    i18nAlternateBase: base,
  } = mergedOptions

  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut)

  const ssrConfig: UserConfig = {
    build: {
      ssr: join(root, entry),
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false,
    },
  }

  buildLog('Build for client...')

  await viteBuild({
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: join(root, './index.html'),
        },
      },
    },
  }) as RollupOutput

  buildLog('Build for server...')

  process.env.VITE_SSG = 'true'
  await viteBuild(ssrConfig)

  const ssrManifest: Manifest = JSON.parse(await fs.readFile(join(out, 'ssr-manifest.json'), 'utf-8'))

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createApp } = require(join(ssgOut, 'main.js')) as {
    createApp(
      client: boolean,
      base?: string,
      requestHeaders?: {
        acceptLanguage?: string
        requestUrl?: string
        localeCookie?: string
      }
    ): Promise<ViteSSGContext<true> | ViteSSGContext<false>>
  }

  const context = await createApp(false, base)

  const { routes, initialState } = context

  let routesPaths: string[]

  const i18n = extractI18nOptions(context)

  if (i18n) {
    routesPaths = []
    const { defaultLocale, defaultLocaleOnUrl, localePathVariable, locales } = i18n
    const normalizedLocale = createLocalePathRoute(localePathVariable)
    const localeRoute = routes!.filter(r => r.path === normalizedLocale)
    if (localeRoute) {
      routesPaths = await includedRoutes(routesToPaths(localeRoute[0].children || []))
      const newRoutes: string[] = []
      // in case requiresMapDefaultLocale we also need to include all default routes inside the directory
      if (defaultLocaleOnUrl) {
        locales.map(l => l.locale).forEach((l) => {
          routesPaths.forEach((path) => {
            newRoutes.push(`/${l}/${path.startsWith('/') ? path.substring(1) : path}`)
          })
        })
        routesPaths.splice(0, routesPaths.length, ...newRoutes)
      }
      else {
        locales.map(l => l.locale).filter(l => l !== defaultLocale).forEach((l) => {
          routesPaths.forEach((path) => {
            newRoutes.push(`/${l}/${path.startsWith('/') ? path.substring(1) : path}`)
          })
        })
        routesPaths.push(...newRoutes)
      }
    }
  }
  else {
    routesPaths = await includedRoutes(routesToPaths(routes))
  }
  // uniq
  routesPaths = Array.from(new Set(routesPaths))

  let indexHTML = await fs.readFile(join(out, 'index.html'), 'utf-8')

  indexHTML = rewriteScripts(indexHTML, script)

  buildLog('Rendering Pages...', routesPaths.length)

  if (mock) {
    const virtualConsole = new VirtualConsole()
    const jsdom = new JSDOM('', { url: 'http://localhost', virtualConsole })
    // @ts-ignore
    global.window = jsdom.window
    Object.assign(global, jsdom.window)
  }

  await Promise.all(
    routesPaths.map(async(route) => {
      const ssgContext = await createApp(false, base, {
        requestUrl: route,
      })
      const { app, router, head } = ssgContext

      if (router) {
        await router.push(route)
        await router.isReady()
      }

      const transformedIndexHTML = (await onBeforePageRender?.(route, indexHTML)) || indexHTML

      const ctx: SSRContext = {}
      const appHTML = await renderToString(app, ctx)

      // need to resolve assets so render content first
      const renderedHTML = renderHTML({ indexHTML: transformedIndexHTML, appHTML, initialState })

      // create jsdom from renderedHTML
      const jsdom = new JSDOM(renderedHTML)

      // render current page's preloadLinks
      renderPreloadLinks(jsdom.window.document, ctx.modules || new Set<string>(), ssrManifest)

      await applyI18nSSG(ssgContext)

      // render head
      head?.updateDOM(jsdom.window.document)

      const html = jsdom.serialize()
      const transformed = (await onPageRendered?.(route, html)) || html
      const formatted = format(transformed, formatting)

      const relativeRoute = (route.endsWith('/') ? `${route}index` : route).replace(/^\//g, '')
      const filename = `${relativeRoute}.html`

      await fs.ensureDir(join(out, dirname(relativeRoute)))
      await fs.writeFile(join(out, filename), formatted, 'utf-8')

      config.logger.info(
        `${chalk.dim(`${outDir}/`)}${chalk.cyan(filename)}\t${chalk.dim(getSize(formatted))}`,
      )
    }),
  )

  await fs.remove(ssgOut)

  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.green('Build finished.')}`)

  onFinished?.()
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync')
    return indexHTML
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `)
}

function renderHTML({ indexHTML, appHTML, initialState }: { indexHTML: string; appHTML: string; initialState: any }) {
  return indexHTML
    .replace(
      '<div id="app"></div>',
      `<div id="app" data-server-rendered="true">${appHTML}</div>\n\n<script>window.__INITIAL_STATE__=${initialState}</script>`,
    )
}

function format(html: string, formatting: ViteSSGOptions['formatting']) {
  if (formatting === 'minify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('html-minifier').minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: true,
      minifyJS: true,
      minifyCSS: true,
    })
  }
  else if (formatting === 'prettify') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('prettier').format(html, { semi: false, parser: 'html' })
  }
  return html
}

async function detectEntry(root: string) {
  // pick the first script tag of type module as the entry
  const scriptSrcReg = /<script(?:.*?)src=["'](.+?)["'](?!<)(?:.*)\>(?:[\n\r\s]*?)(?:<\/script>)/img
  const html = await fs.readFile(join(root, 'index.html'), 'utf-8')
  const scripts = [...html.matchAll(scriptSrcReg)] || []
  const [, entry] = scripts.find((matchResult) => {
    const [script] = matchResult
    const [, scriptType] = script.match(/.*\stype=(?:'|")?([^>'"\s]+)/i) || []
    return scriptType === 'module'
  }) || []
  return entry || 'src/main.ts'
}
