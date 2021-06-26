# Vite SSG

Server-side generation for Vite.

[![NPM version](https://img.shields.io/npm/v/vite-ssg?color=a1b858)](https://www.npmjs.com/package/vite-ssg)

> ℹ️ **Vite 2 is supported from `v0.2.x`, Vite 1's support is discontinued.**

## Install

> **This library requires Node.js version >= 14**

<pre>
<b>npm i -D vite-ssg</b> <em>@vue/server-renderer @vue/compiler-sfc vue-router@next @vueuse/head</em>
</pre>

```diff
// package.json
{
  "scripts": {
    "dev": "vite",
-   "build": "vite build"
+   "build": "vite-ssg build"
  }
}
```

```ts
// src/main.ts
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'

// `export const createApp` is required
export const createApp = ViteSSG(
  // the root component
  App,
  // vue-router options
  { routes },
  // function to have custom setups
  ({ app, router, routes, isClient, initialState }) => {
    // install plugins etc.
  }
)
```

### Single Page SSG

To have SSG for the index page only (without `vue-router`), import from `vite-ssg/single-page` instead.

```ts
import { ViteSSG } from 'vite-ssg/single-page'

export const createApp = ViteSSG(App)
```

### `<ClientOnly/>`

Component `ClientOnly` is registered globally along with the app creation.

```html
<client-only>
  <your-client-side-components />
</client-only>
```

## Document head

From `v0.4.0`, we ships [`@vueuse/head`](https://github.com/vueuse/head) to manage the document head out-of-box. You can directly use it in your pages/components, for example:

```html
<template>
  <button @click="count++">Click</button>
</template>

<script setup>
import { useHead } from '@vueuse/head'

useHead({
  title: 'Website Title',
  meta: [
    {
      name: `description`,
      content: `Website description`,
    },
  ],
})
</script>
```

That's all, no configuration needed. Vite SSG will handle the server-side rendering and merging automatically.

Refer to [`@vueuse/head`'s docs](https://github.com/vueuse/head) for more usage about `useHead`.

## Initial State

The initial state comprises data that is serialized to your server-side generated HTML that is hydrated in
the browser when accessed. This data can be data fetched from a CDN, an API, etc, and is typically needed
as soon as the application starts or is accessed for the first time.

The main advantage of setting the application's initial state is that the statically generated pages do not
need to fetch the data again as the data is fetched during build time and serialized into the page's HTML.

The initial state is a plain JavaScript object that can be set during SSR, i.e., when statically generating
the pages, like this:

```ts
// src/main.ts

// ...

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, routes, isClient, initialState }) => {
    // ...

    if (import.meta.env.SSR) {
      // Set initial state during server side
      initialState.data = { cats: 2, dogs: 3 }
    } else {
      // Restore or read the initial state on the client side in the browser
      console.log(initialState.data) // => { cats: 2, dogs: 3 }
    }

    // ...
  }
)
```

Typically, you will use this with an application store, such as
[Vuex](https://vuex.vuejs.org/) or [Pinia](https://pinia.esm.dev/).
For examples, see below:

<details><summary>When using Pinia</summary>
<p>
Following [Pinia's guide](https://pinia.esm.dev/ssr), you will to adapt your `main.{ts,js}` file to look
like this:

```ts
// main.ts
import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import routes from 'virtual:generated-pages'
// use any store you configured that you need data from on start-up
import { useRootStore } from './store/root'
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, initialState }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (import.meta.env.SSR) {
      initialState.pinia = pinia.state.value
    } else {
      pinia.state.value = initialState.pinia || {}
    }

    router.beforeEach((to, from, next) => {
      const store = useRootStore(pinia)
      if (!store.ready)
        // perform the (user-implemented) store action to fill the store's state
        store.initialize()
      next()
    })
  },
)
```
</p></details>

<details><summary>When using Vuex</summary>
<p>

```ts
// main.ts
import { ViteSSG } from 'vite-ssg'
import routes from 'virtual:generated-pages'
import { createStore } from 'vuex'
import App from './App.vue'

// Normally, you should definitely put this in a separate file
// in order to be able to use it everywhere
const store = createStore({
  // ...
})

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, initialState }) => {
    app.use(store)

    if (import.meta.env.SSR) {
      initialState.store = store.state
    } else {
      store.replaceState(initialState.store)
    }

    router.beforeEach((to, from, next) => {
      // perform the (user-implemented) store action to fill the store's state
      if (!store.getters.ready)
        store.dispatch('initialize')

      next()
    })
  },
)
```
</p></details>

For the example of how to use a store with an initial state in a single page app,
see [the single page example](./examples/single-page/src/main.ts).

### State Serialization

Per default, the state is deserialized and serialized by using `JSON.stringify` and `JSON.parse`.
If this approach works for you, you should definitely stick to it as it yields far better
performance.

You may use the option `transformState` in the `ViteSSGClientOptions` as displayed below.
A valid approach besides `JSON.stringify` and `JSON.parse` is
[`@nuxt/devalue`](https://github.com/nuxt-contrib/devalue) (which is used by Nuxt.js):

```ts
import devalue from '@nuxt/devalue'
import { ViteSSG } from 'vite-ssg'
// ...
import App from './App.vue'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, initialState }) => {
    // ...
  },
  {
    transformState(state) {
      return import.meta.env.SSR ? devalue(state) : state
    },
  },
)
```

**A minor remark when using `@nuxt/devalue`:** In case, you are getting an error because of a `require`
within the package `@nuxt/devalue`, you have to add the following piece of config to your Vite config:

```ts
// vite.config.ts
//...

export default defineConfig({
  resolve: {
    alias: {
      '@nuxt/devalue': '@nuxt/devalue/dist/devalue.js',
    },
  },
  // ...
})
```

## Configuration

You can pass options to Vite SSG in the `ssgOptions` field of your `vite.config.js`

```js
// vite.config.js

export default {
  plugins: [ /*...*/ ],
  ssgOptions: {
    script: 'async'
  }
}
```

See [src/types.ts](./src/types.ts). for more options available.

### Custom Routes to Render

You can use the `includedRoutes` hook to exclude/include route paths to render, or even provide some complete custom ones.

```js
// vite.config.js

export default {
  plugins: [ /*...*/ ],
  ssgOptions: {
    includedRoutes(routes) {
      // exclude all the route paths that contains 'foo'
      return routes.filter(i => !i.includes('foo'))
    }
  }
}
```

## WIP `vite-ssg/i18n`

This feature will allow you to build your application with a single codebase with a router supporting `i18n` via `vue-i18n@next`.

When building, `vite-ssg/i18n` will generate all html pages for all your routes for all your locales under its corresponding 
locale directory. 

You only need to configure `vite-ssg/i18n` properly and let it do its magic.

By default, `vite-ssg/i18n` will register `/:locale?` as the parent of all your routes.

You can change the `locale` name using `localePathVariable` on `i18nOptions`.

The default locale will not be included in the browser url, unless it is explicitly configured in the 
`defaultLocaleOnUrl: true` option, or your routes contain a dynamic route as a higher level route.

### Components and composables

Since `vite-ssg/i18n` will handle `i18n` for you, you only need to use some `locale` aware components and some composables.

- `i18n-router-view` component: `vite-ssg/i18n` will register `i18n-router-view` that is the equivalent to `router-view` but `locale` aware.
  You can use it without having to include the `locale` on it, `vite-ssg/i18n` will take care for you.

  For example, instead using `router-view` passing the `locale` to the `:to` props,
  use `i18n-router-view` and forget the `locale` param.

- `useGlobalI18n` function: will expose `useI18n({ useScope: 'global' })`.
  
- `useAvailableLocales` function: will expose the locales you have configured, and so you can create a locale switcher.
  You can use in that case `router-view`, the `available locales` will include the `to` prop
  for the current route:
  ```html
  // src/App.vue
  <script setup lang="ts">
  import { useAvailableLocales } from 'vite-ssg/i18n'
    
  const { availableLocales, route } = useAvailableLocales()
    
  </script>
    
  <template>
    <nav>
      <RouterLink
        v-for="({ locale, description, to, current }) in availableLocales"
        :key="locale"
        :aria-current="current"
        :to="to"
      >
        {{ description }}
      </RouterLink>
    </nav>
    <main>
      <router-view :key="route.fullPath" />
    </main>
  </template>
  ```

- `useI18nRouter` function: use this `Router` instead `vue-router`. This Router will
  handle all `locale` for you.
  
- `injectHeadObject` function: will expose `HeadObject` reference if you need to manipulate
the header in some `page` to do some customization.

### I18n Configuration

You need to add `vue-i18n` to your dependencies: `npm install vue-i18n@next` or `yarn add vue-i18n@next`

Configure `i18nAlternateBase` on `ssgOptions` on `vite.config.ts` file for alternate hrefs:
```ts
// vite.config.ts
ssgOptions: {
  // other options
  // i18n alternate base hrefs  
  i18nAlternateBase: 'http://localhost:3000'
}
```

You need to configure `i18nOptions` on your `main.ts` when calling `ViteSSG`:

```ts
// src/main.ts
import { ViteSSG, ViteI18nSSGContext } from 'vite-ssg/i18n'

export const createApp = ViteSSG(
  App,
  {routes},
  {
    i18nOptions: {
      defaultLocale: 'en',
      defaultLocaleOnUrl: false,
      locales: {
        en: 'English',
        es: 'Español'
      }
    }
  },
  (ctx: ViteI18nSSGContext) => { /* some logic */ }
)

```

### Localize your SFC pages/components

We recommend use `<i18n global>` component in your `SFC` using external location when the messages are huge or inlined
when messages are few.

In both cases, you need to install `@intlify/vite-plugin-vue-i18n` as `dev dependency`:
`npm i -D @intlify/vite-plugin-vue-i18n` or `yarn add -D @intlify/vite-plugin-vue-i18n`.

Once installed, you will need to configure the plugin on your `vite.config.ts` file:
```ts
import VueI18n from '@intlify/vite-plugin-vue-i18n'

plugins: [
  VueI18n(/* options */)
]
```

#### Using inlined messages

In your `SFC` you only need to add the `<i18n global>` component (you can see options [here](https://vue-i18n.intlify.dev/guide/advanced/sfc.html#basic-usage))

For example, you can use `yml/yaml` (you can also use `json` or `json5`):
```html
// src/pages/page-a.vue
<i18n global lang="yml">
en:
  PageA:
    title: Page A
    description: Description for page A
es:
  PageA:
    title: Página A
    description: Descripción  de la página A
</i18n>
<script setup lang="ts">
  import { useGlobalI18n } from 'vite-ssg/i18n'
  
  import { t } = useGlobalI18n()
</script>
<template>
  <h1>{{ t('PageA.title') }}</h1>
</template>
```

#### Using external messages

In your `SFC` you only need to add the `<i18n global src="<external location relative to the page component>">` component (you can see options [here](https://vue-i18n.intlify.dev/guide/advanced/sfc.html#basic-usage))

In order to use external messages to work, you will need to configure `@intlify/vite-plugin-vue-i18n` including
the paths where it can find external resources you configure:
```ts
// vite.config.ts
import VueI18n from '@intlify/vite-plugin-vue-i18n'

plugins: [
  VueI18n(
    // other options
    includes: ['locales/**', 'locales/pages/**']
  )
]
```

For example, you can use `yml/yaml` files (you can also use `json` or `json5`):
```html
// src/pages/page-a.vue
<i18n global src="../../locales/pages/page-a.yml"></i18n>
<script setup lang="ts">
  import { useGlobalI18n } from 'vite-ssg/i18n'

  import { t } = useGlobalI18n()
</script>
<template>
  <h1>{{ t('PageA.title') }}</h1>
</template>
```
where `../../locales/pages/page-a.yml` includes:
```yml
// locales/pages/page-a.yml
en:
  PageA:
    title: Page A
    description: Description for page A
es:
  PageA:
    title: Página A
    description: Descripción  de la página A
```

### Head configuration

`vite-ssg/i18n` can handle all head info for you, but requires some hints to automatically to do it: it requires **only**
the `pageI18nKey` on the meta route (by default it will use the `route name or route path` with `/` prefix).

You must configure `pageI18nKey` on your routes and so you can reference with your `pageI18nKey`:
```ts
const routes = [
  { path: '/', meta: { pageI18nKey: 'Index' }, component: defineAsyncComponent(() => import('./pages/home.vue')) },
  { path: '/about', meta: { pageI18nKey: 'About' }, component: defineAsyncComponent(() => import('./pages/about.vue')) },
  { path: '/hi/:name', meta: { pageI18nKey: 'Hi' }, component: defineAsyncComponent(() => import('./pages/hi/[name].vue')), props: true },
]
```

If you are using `vite-plugin-pages` plugin, there is a way to include `pageI18nKey` inside your `SFC` page (nice, no?):
```html
// src/pages/page-a.vue
<route lang="yaml">
meta:
  pageI18nKey: PageA
</route>

<i18n global src="../../locales/pages/page-a.yml"></i18n>

<script setup lang="ts">
  import { useGlobalI18n } from 'vite-ssg/i18n'

  import { t } = useGlobalI18n()
</script>
<template>
  <h1>{{ t('PageA.title') }}</h1>
</template>
```

#### What will `vite-ssg/i18n` include for you on the head page?
1) `lang` attribute for `html` element:
```html
<html lang="en">
```
2) `title` and `og:title` head entries from `route.meta.title` or looking for it from the `i18n` composer using 
`${route.meta.pageI18nKey}.${route.meta.titleKey}`:
```html
<title><TITLE></title>
```
3) `description` and `og:description` meta head entries from `route.meta.description` or looking for it from the `i18n` 
composer using `${route.meta.pageI18nKey}.${route.meta.descriptionKey}`:
```html
<meta name="description" content="<DESCRIPTION>">
```
4) Meta tag for `og:locale` for the current locale:
```html
<meta property="og:locale" content="en">
```
5) Meta tags for `og:image` and `twitter:card` from `route.meta.image` or looking for it from the `i18n` 
composer using `${route.meta.pageI18nKey}.${route.meta.imageKey}`, `twitter:card` will be added only if `og:image` 
is present:
```html
<meta property="og:image" content="<IMAGE>">
<meta property="twitter:card" content="summary_large_image">
```   
6) Meta tag to avoid browser showing page translation popup:
```html
<meta name="google" content="notranslate">
```
7) `link`s for alternate urls for each locale, for example ( `en` is the default locale ). Remember that you will
   need to provide the `base` option when generation html pages, since these `alternate` will require the `href`
   to include also the protocol, `http or https`, (see [Guidelines for all methods](https://developers.google.com/search/docs/advanced/crawling/localized-versions#all-method-guidelines)).
   For client side, there is no need to include it, `vite-ssg` will use `window.location.origin`.
```html
<link rel="alternate" hreflang="x-default" href="http://localhost:3000/route">
<link rel="alternate" hreflang="es" href="http://localhost:3000/es/route">
```

You can also customize each head page, using `headConfigurer` callback on `i18nOptions` option, 
see [Customizing head for each page](#customizing-head-for-each-page) below.

### Advanced configuration

By default `vite-ssg/i18n` will do a lot for you, but you can customize your own behavior via callbacks using `i18nOptions` option.

#### Registering I18n global messages

You may have a set of `global messages` that will be shared between all pages of your application (for example common buttons
texts, dialog messages, etc...).

You can provide these `global messages` using the callback `globalMessageResolver`, for example:
```ts
// src/main.ts
import { ViteSSG, ViteI18nSSGContext } from 'vite-ssg/i18n'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const globalMessages: Record<string, any> = Object.fromEntries(Object.entries(import.meta.globEager('../locales/*.yml'))
  .map(([key, value]) => [key.slice(11, -4), value.default])
)

export const createApp = ViteSSG(
  App,
  { routes },
  {
    i18nOptions: {
      defaultLocale: 'en',
      defaultLocaleOnUrl: false,
      locales: {
        en: 'English',
        es: 'Español'
      },
      globalMessages
   }
  },
  (ctx: ViteI18nSSGContext) => { /* some logic */ }
}
```

#### Loading custom page messages resouces

Instead of using `<i18n>` component on your `SFC` page components, you can customize it using `import.meta.glob`, `import.meta.globEager`
or `dynamic imports` on `routeMessages` callback in from `i18nOptions` option. 

`vite-ssg` will take care for you exposing under `i18n` global composer. For example:
```ts
// src/main.ts
import { ViteSSG, ViteI18nSSGContext } from 'vite-ssg/i18n'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const globalMessages: any = Object.fromEntries(Object.entries(import.meta.globEager('../locales/*.yml'))
  .map(([key, value]) => [key.slice(11, -4), value.default]),
)

export const createApp = ViteSSG(
  App,
  { routes },
  {
    i18nOptions: {
      defaultLocale: 'en',
      defaultLocaleOnUrl: false,
      locales: {
        en: 'English',
        es: 'Español'
      },
      globalMessages,
      async routeMessages(locale, to) {
        try {
          const messagesModule = await import(/* @vite-ignore */ `../locales/pages/${to.meta.pageI18nKey}.yml`)
          return messagesModule.default || messagesModule
        }
        catch (e) {
          console.error(`something was wrong loading route page messages: ${to.path}`, e)
          return undefined
        }
      }
    }
  },
  (ctx: ViteI18nSSGContext) => { /* some logic */ }
}
```

#### Customizing head for each page

You can customize the head of each page using `headConfigurer` callback from `i18nOptions` option:
```ts
// src/main.ts
import { ViteSSG, ViteI18nSSGContext } from 'vite-ssg/i18n'

// import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
const globalMessages: any = Object.fromEntries(Object.entries(import.meta.globEager('../locales/*.yml'))
  .map(([key, value]) => [key.slice(11, -4), value.default])
)

export const createApp = ViteSSG(
  App,
  { routes },
  {
    i18nOptions: {
      defaultLocale: 'en',
      defaultLocaleOnUrl: false,
      locales: {
        en: 'English',
        es: 'Español'
      },
      globalMessages,
      async headConfigurer(route, headObject, i18nComposer, locale) {
        const meta = route.meta
        if (meta && meta.injectI18nMeta) {
          // you can delegate to default behavior
          headObject.value = meta.injectI18nMeta(
            headObject.value,
            locale,
            i18nComposer
          )
          // you can customize the entire head object
          /*
          const routeName = route.name?.toString() || route.path
          // we can add what we want, also change the entire headObject
          meta.injectI18nMeta(
            headObject.value,
            locale,
            i18nComposer,
            i18nComposer.t(`page-${routeName}.title`),
            i18nComposer.t(`page-${routeName}.description`)
          )
          */
          // or you can change the entire head object page
          // headObject.value = (await import(...)).default
        }
          
        return true
      }
    }
  },
  (ctx: ViteI18nSSGContext) => { /* some logic */ }
)

```

### Changes to be made for existing applications

If you want to migrate your existing application with `i18n` support, you need to do the following:

1) update `vite-ssg` to the latest version 
2) add `vue-i18n` to your dependencies: `npm install vue-i18n@next` or `yarn add vue-i18n@next`
2) change all `useRouter()` to `useI18nRouter()`: `import {useI18nRouter} from 'vite-ssg/i18n'`
3) change all `useI18n()`, if you are using it, with `useGlobalI18n()`: `import { useGlobalI18n } from 'vite-ssg/i18n'`
4) change all `<router-link>` to `<i18n-router-link>`: just keep all props, only change the component
5) remove all `useHead` in all your pages: `vite-ssg/i18n` will handle changes for you
6) change the import of `ViteSSG` on your `main.ts`:
  ```ts
  // src/main.ts
  import { ViteSSG } from 'vite-ssg'

  export const createApp = ViteSSG(App, { routes })
  ```
  with
  ```ts
  // src/main.ts
  import { ViteSSG } from 'vite-ssg/i18n'
  ```
7) if you need to configure `vue-i18n` global messages, you need to change:
  ```ts
  // src/main.ts
  import { ViteSSG } from 'vite-ssg'

  export const createApp = ViteSSG(App, { routes })
  ```
  with
  ```ts
  // src/main.ts
  import { ViteSSG, ViteI18nSSGContext } from 'vite-ssg/i18n'

  export const createApp = ViteSSG(
    App, 
    { routes },
    {
      // other options
      // i18n options  
      i18nOptions: {
        defaultLocale: 'en',
        defaultLocaleOnUrl: false,
        locales: {
          en: 'English',
          es: 'Español'
        }
      }
    },
    (ctx: ViteI18nSSGContext) => { /* some logic */ }
  )
  ```
8) add `i18nOptions` configuration to `ssgOptions` on `vite.config.ts` file:
  ```ts
  // vite.config.ts
  ssgOptions: {
    // other options
    // i18n alternate base hrefs  
    i18nAlternateBase: 'http://localhost:3000'
  }
  ```

## Comparison

### Use [Vitepress](https://github.com/vuejs/vitepress) when you want:

- Zero config, out-of-box
- Single-purpose documentation site
- Lightweight ([No double payload](https://twitter.com/youyuxi/status/1274834280091389955))

### Use Vite SSG when you want

- More controls on the build process and tooling
- The flexible plugin systems
- Multi-purpose application with some SSG to improve SEO and loading speed
- Multi-language support with a single codebase

Cons:

- Double payload

## Example

See [Vitesse](https://github.com/antfu/vitesse)

## Thanks to the prior work

- [vitepress](https://github.com/vuejs/vitepress/tree/master/src/node/build)
- [vue3-vite-ssr-example](https://github.com/tbgse/vue3-vite-ssr-example)
- [vite-ssr](https://github.com/frandiox/vite-ssr)

## License

MIT License © 2020 [Anthony Fu](https://github.com/antfu)
