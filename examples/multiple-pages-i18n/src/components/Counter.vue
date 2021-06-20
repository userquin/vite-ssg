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

<script setup lang="ts">
import { defineProps, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ init?: number }>()
const { t, locale } = useI18n({ useScope: 'global' })
watch(locale, (l) => {
  console.log(`LOCALE CHANGED: ${locale}`)
})
const counter = ref(props.init || 0)
</script>

<style scoped>
.counter {
  border: 2px dashed #3eaf7c;
  padding: 5px 10px 10px 10px;
}
</style>
