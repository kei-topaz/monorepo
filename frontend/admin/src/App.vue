<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { setToastInstance } from '@/plugins/errorHandler'

const toast = useToast()
setToastInstance(toast)
</script>

<template>
  <Toast />
  <RouterView />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Pretendard', system-ui, sans-serif;
  color: var(--p-text-color);
  background: var(--p-surface-ground);
}
</style>
