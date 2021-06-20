<script setup lang="ts">
import { useAvailableLocales } from 'vite-ssg'

const { availableLocales, route } = useAvailableLocales()

// useI18nHead(async(locale) => {
//   console.log(`LOCALE RELOAD: ${locale.locale}`)
//   try {
//     let modules = await import(/* @vite-ignore */ `../locales/pages/${route.meta.rawPath}.yml`)
//     let page = modules.default[locale.locale]
//
//     console.log('YAML')
//     console.log(page)
//
//     modules = await import(/* @vite-ignore */ `../locales/pages/${route.meta.rawPath}.json5`)
//     page = modules.default[locale.locale]
//
//     console.log('JSON5')
//     console.log(page)
//   }
//   catch (err) {
//     console.error('upps', err)
//   }
//   return {
//     title: 'Hello',
//     meta: [
//       {
//         name: 'description',
//         content: 'Website description',
//       },
//     ],
//     style: [
//       {
//         children: 'body {color: #567839}',
//       },
//     ],
//   }
// })
</script>

<template>
  <nav>
    <RouterLink
      v-for="({ locale, description, to }) in availableLocales"
      :key="locale"
      :to="to"
    >
      {{ description }}
    </RouterLink>
  </nav>
  <main>
    <router-view :key="route.fullPath" />
  </main>
</template>

<style scoped>
nav {
  padding: 1rem 10em;
}
nav a:not(:first-of-type) {
  padding-left: 1rem;
}
main {
  padding: 4em 10em;
}
</style>
