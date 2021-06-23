<!-- if using i18n with src, you will need to include src -->
<!-- on includes option of VueI18n plugin configuration   -->
<!-- on vite.config.ts                                    -->
<!-- will need be listed on  -->
<i18n src="./b.json5"></i18n>
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
<!--
<i18n lang="yml">
en:
  /b:
    title: Hello
    description: Website description
    imgtitle: Image for hello I am B

es:
  /b:
    title: Hola
    description: Descripción del sitio web
    imgtitle: Imagen para hola soy B
</i18n>
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { defineProps, ref } from 'vue'
import { useI18nRouter } from 'vite-ssg'

const props = defineProps({ locale: String })

const router = useI18nRouter()
const { t } = useI18n()

const name = ref('')

const go = () => {
  if (name.value)
    router.push(`/hi/${encodeURIComponent(name.value)}`)
}
</script>

<template>
  <p>{{ t('/b.title') }}</p>
  <input
    id="input"
    v-model="name"
    :placeholder="t('/b.whats-your-name')"
    :aria-label="t('/b.whats-your-name')"
    type="text"
    autocomplete="false"
    @keydown.enter="go"
  >
  <img src="../assets/test.jpg" :alt="t('/b.imgtitle')">
</template>
