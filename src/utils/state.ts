// https://github.com/yahoo/serialize-javascript
import { App } from 'vue'
import { HeadClient } from '@vueuse/head'
import { Router, RouteRecordRaw } from 'vue-router'
import { CreateVueI18n, LocaleInfo } from '../i18n/types'
import { ViteSSGContext } from '../types'

const UNSAFE_CHARS_REGEXP = /[<>\/\u2028\u2029]/g
const ESCAPED_CHARS = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

function escapeUnsafeChars(unsafeChar: string) {
  return ESCAPED_CHARS[unsafeChar as keyof typeof ESCAPED_CHARS]
}

export function serializeState(state: any) {
  try {
    return JSON.stringify(JSON.stringify(state || {})).replace(
      UNSAFE_CHARS_REGEXP,
      escapeUnsafeChars,
    )
  }
  catch (error) {
    console.error('[SSG] On state serialization -', error, state)
    return '{}'
  }
}

export function deserializeState(state: string) {
  try {
    return JSON.parse(state || '{}')
  }
  catch (error) {
    console.error('[SSG] On state deserialization -', error, state)
    return {}
  }
}

export async function initializeState(
  app: App,
  head: HeadClient | undefined,
  isClient: boolean,
  client: boolean,
  router: Router,
  routes: RouteRecordRaw[],
  createI18n: CreateVueI18n | undefined,
  localeInfo: LocaleInfo | undefined,
  fn?: (context: ViteSSGContext<true>) => Promise<void> | void,
  transformState?: (state: any) => any,
): Promise<ViteSSGContext<true>> {
  const context: ViteSSGContext<true> = { app, head, isClient, router, routes, createI18n, initialState: {} }

  if (client)
    // @ts-ignore
    context.initialState = transformState?.(window.__INITIAL_STATE__ || {}) || deserializeState(window.__INITIAL_STATE__)

  await fn?.(context)

  return context
}
