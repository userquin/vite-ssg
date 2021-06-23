<script setup lang="ts">
import { useAvailableLocales } from 'vite-ssg'

const { availableLocales, route } = useAvailableLocales()

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
