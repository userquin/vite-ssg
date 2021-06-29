<route>
meta:
  pageI18nKey: HiPage
</route>

<i18n lang="yaml" global>
en:
  HiPage:
    title: Hi {name}
    description: Hi {name}
    hi: Hi {name}
    dynamic-route: Dynamic route
    back: Back
es:
  HiPage:
    title: Hola {name}
    description: Hola {name}
    hi: Hola {name}
    dynamic-route: Ruta dinámica
    back: Volver
</i18n>

<script setup lang="ts">
import { useI18nRouter, useGlobalI18n } from 'vite-ssg/i18n'
import { defineProps } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
})

const router = useI18nRouter()
const { t } = useGlobalI18n()
</script>

<template>
  <div>
    <p>
      {{ t('HiPage.hi', { name: props.name }) }}
    </p>
    <p>
      <em>{{ t('HiPage.dynamic-route') }}</em>
    </p>

    <div>
      <button @click="router.back()">
        {{ t('HiPage.back') }}
      </button>
    </div>
  </div>
</template>
