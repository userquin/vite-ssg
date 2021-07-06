<template>
  <p>Hello I am B</p>
  <br />
  <counter />
  <br />
  <img src="../assets/test.jpg" alt="" width="640" height="485">
</template>

<script lang="ts">
import { useHead } from '@vueuse/head'

export default {
  setup() {
    useHead({
      title: 'Hello',
      meta: [
        {
          name: 'description',
          content: 'Website description',
        },
      ],
      style: [
        {
          children: 'body {color: #567839}',
        },
      ],
    })
  },
  serverPrefetch() {
    console.log('prefetch')
  },
}
</script>
