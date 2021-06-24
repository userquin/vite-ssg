<route lang="yaml">
meta:
  pageI18nKey: HiPage
  isGlobal: true
</route>

<i18n lang="yaml">
en:
  HiPage:
    hi: Hi {name}
    dynamic-route: Dynamic route
    back: Back
es:
  HiPage:
    hi: Hola {name}
    dynamic-route: Ruta dinámica
    back: Volver
</i18n>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { defineProps } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
})

const router = useRouter()
const { t } = useI18n()
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
