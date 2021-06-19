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
import { defineProps, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ init?: number }>()
const { t } = useI18n()

const counter = ref(props.init || 0)
</script>

<style scoped>
.counter {
  border: 2px dashed #3eaf7c;
  padding: 5px 10px 10px 10px;
}
</style>
