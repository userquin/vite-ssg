<i18n lang="yml">
en:
  /hi:
    hi: Hi {name}
    dynamic-route: Dynamic route
    back: Back
es:
  /hi:
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
      {{ t('/hi.hi', { name: props.name }) }}
    </p>
    <p class="text-sm opacity-50">
      <em>{{ t('/hi.dynamic-route') }}</em>
    </p>

    <div>
      <button
        class="btn m-3 text-sm mt-8"
        @click="router.back()"
      >
        {{ t('/hi.back') }}
      </button>
    </div>
  </div>
</template>
