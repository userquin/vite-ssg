<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { HeadObject } from '@vueuse/head'

const { t } = useI18n()
const route = useRoute()

const headObject = computed<HeadObject>(() => {
  const locale = route.params.locale
  const meta = [
    {
      name: 'description',
      content: 'Website description',
    },
  ]
  const head: HeadObject = {
    title: 'Hello',
    meta,
    style: [
      {
        children: 'body {color: #567839}',
      },
    ],
  }

  route.meta?.injectI18nMeta?.(head)

  console.log(head)

  return head
})

useHead(headObject)

</script>
<template>
  <p>{{ t('pageb.title') }}</p>
  <img src="../assets/test.jpg" :alt="t('pageb.imgtitle')">
</template>
