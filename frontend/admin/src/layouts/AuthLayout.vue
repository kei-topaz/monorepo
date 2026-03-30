<script setup lang="ts">
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--p-surface-ground);
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 12px;
}
</style>
