<!-- if using i18n with src, you will need to include src -->
<!-- on includes option of VueI18n plugin configuration   -->
<!-- on vite.config.ts                                    -->
<!-- will need be listed on  -->
<!--<i18n src="./b.json5" global></i18n>-->
<!-- 👇 see below alternatives -->
<!--<i18n src="./b.yml"></i18n>-->
<!--<i18n src="./b.yaml"></i18n>-->
<!--<i18n src="../../locales/pages/b.json5"></i18n>-->
<!--<i18n src="../../locales/pages/b.yml"></i18n>-->
<!--
<i18n lang="json5">
{
  "en": {
    "/b": {
      "title": "Hello",
      "description": "Website description",
      "imgtitle": "Image for hello I am B",
    },
  },
  "es": {
    "/b": {
      "title": "Hola",
      "description": "Descripción del sitio web",
      "imgtitle": "Imagen para hola I soy B",
    },
  }
}
</i18n>
-->
<script setup lang="ts">
import { defineProps, onMounted, ref } from 'vue'
import { useI18nRouter, useGlobalI18n } from 'vite-ssg'

const props = defineProps({ locale: String })

const router = useI18nRouter()
const { t } = useGlobalI18n()

const name = ref('')

onMounted(() => {
  console.log(t('PageB.title'))
  console.log(t('PageB.description'))
})

const go = () => {
  if (name.value)
    router.push(`/hi/${encodeURIComponent(name.value)}`)
}
</script>

<route lang="yaml">
meta:
  pageI18nKey: PageB
</route>

<i18n lang="yaml" global>
en:
  PageB:
    title: Hello
    description: Website description
    imgtitle: Image for hello I am B
    whats-your-name: What is your name

es:
  PageB:
    title: Hola
    description: Descripción del sitio web
    imgtitle: Imagen para hola soy B
    whats-your-name: ¿Cómo te llamas?

</i18n>

<template>
  <p>{{ t('PageB.title') }}</p>
  <input
    id="input"
    v-model="name"
    :placeholder="t('PageB.whats-your-name')"
    :aria-label="t('PageB.whats-your-name')"
    type="text"
    autocomplete="false"
    @keydown.enter="go"
  >
  <img src="../assets/test.jpg" :alt="t('PageB.imgtitle')">
</template>
