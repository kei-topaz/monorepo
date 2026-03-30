<script setup lang="ts">
import Button from 'primevue/button'
</script>

<template>
  <Button v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData ?? {}" />
    </template>
  </Button>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
