<script setup lang="ts">
import InputText from 'primevue/inputtext'

const model = defineModel<string>()
</script>

<template>
  <InputText v-bind="$attrs" v-model="model" />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
