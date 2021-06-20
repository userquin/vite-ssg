<script setup lang="ts">
// import { computed } from 'vue'
// import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
// import { useRoute } from 'vue-router'
import { defineProps } from 'vue'
// import type { HeadObject } from '@vueuse/head'

const props = defineProps({ locale: String })

const { t } = useI18n()

// useI18nHead({
//   title: 'Hello',
//   meta: [
//     {
//       name: 'description',
//       content: 'Website description',
//     },
//   ],
//   style: [
//     {
//       children: 'body {color: #567839}',
//     },
//   ],
// })
//
// const route = useRoute()
//
// const headObject = computed<HeadObject>(() => {
//   const locale = route.params.locale
//   const meta = [
//     {
//       name: 'description',
//       content: 'Website description',
//     },
//   ]
//   const head: HeadObject = {
//     title: 'Hello',
//     meta,
//     style: [
//       {
//         children: 'body {color: #567839}',
//       },
//     ],
//   }
//
//   route.meta?.injectI18nMeta?.(head)
//
//   console.log(head)
//
//   return head
// })
//
// useHead(headObject)

</script>

<template>
  <p>{{ t('pageb.title') }}</p>
  <img src="../assets/test.jpg" :alt="t('pageb.imgtitle')">
</template>
