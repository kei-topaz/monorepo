<script setup lang="ts">
import Password from 'primevue/password'

const model = defineModel<string>()
</script>

<template>
  <Password
    v-bind="$attrs"
    v-model="model"
    :feedback="false"
    :toggle-mask="true"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
