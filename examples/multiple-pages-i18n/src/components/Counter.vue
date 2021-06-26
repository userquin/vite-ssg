<script setup lang="ts">
import { defineProps, ref } from 'vue'
import { useGlobalI18n } from 'vite-ssg/i18n'

const props = defineProps<{ init?: number }>()

const { t } = useGlobalI18n()

const counter = ref(props.init || 0)
</script>

<template>
  <div class="counter">
    <div>{{ t('counter', [counter]) }}</div>
    <button @click="counter += 1">
      {{ t('button.inc') }}
    </button>
    <button @click="counter -= 1">
      {{ t('button.dec') }}
    </button>
  </div>
</template>

<style scoped>
.counter {
  border: 2px dashed #3eaf7c;
  padding: 0.5rem 10px 10px 10px;
}
button {
  padding: 0.5rem;
}
button:first-of-type {
  margin-top: 0.5rem;
}
button + button {
  margin-left: 1rem;
}
</style>
