<i18n src="./b.json5"></i18n>
<!-- 👇 see below alternatives -->
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
      "crawling": {
        "style": [
          {
            "children": "body {'{'}color: #567839{'}'}"
          }
        ]
      },
    },
  },
  "es": {
    "/b": {
      "title": "Hola",
      "description": "Descripción del sitio web",
      "imgtitle": "Imagen para hola I soy B",
      "crawling": {
        "style": [
          {
            "children": "body {'{'}color: #567839{'}'}"
          }
        ]
      },
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
    crawling:
      style:
        - children: "body {'{'}color: #567839{'}'}"

es:
  /b:
    title: Hola
    description: Descripción del sitio web
    imgtitle: Imagen para hola soy B
    crawling:
      style:
        - children: "body {'{'}color: #567839{'}'}"
</i18n>
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { defineProps } from 'vue'

const props = defineProps({ locale: String })

const { t } = useI18n()
</script>

<template>
  <p>{{ t('/b.title') }}</p>
  <img src="../assets/test.jpg" :alt="t('/b.imgtitle')">
</template>
