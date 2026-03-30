<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()
const sidebarVisible = ref(true)

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

function handleLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <button class="topbar-toggle" @click="toggleSidebar">
        <i class="pi pi-bars" />
      </button>
      <span class="topbar-title">관리자 패널</span>
      <div class="topbar-user">
        <span class="topbar-email">{{ auth.email }}</span>
        <span class="topbar-authority">{{ auth.authority }}</span>
      </div>
      <button class="topbar-logout" @click="handleLogout">
        <i class="pi pi-sign-out" />
        <span>로그아웃</span>
      </button>
    </header>

    <div class="layout-content">
      <aside v-show="sidebarVisible" class="sidebar">
        <nav>
          <RouterLink to="/" class="sidebar-link">
            <i class="pi pi-home" />
            <span>대시보드</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;

  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.topbar-toggle {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
}

.topbar-title {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 600;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.topbar-email {
  opacity: 0.9;
}

.topbar-authority {
  padding: 0.125rem 0.5rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 0.75rem;
}

.topbar-logout {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.topbar-logout:hover {
  background: rgba(255, 255, 255, 0.15);
}

.layout-content {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 240px;
  background: var(--p-surface-100);
  border-right: 1px solid var(--p-surface-200);
  padding: 1rem 0;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.25rem;
  color: var(--p-text-color);
  text-decoration: none;
  transition: background 0.15s;
}

.sidebar-link:hover {
  background: var(--p-surface-200);
}

.main {
  flex: 1;
  padding: 1.5rem;
}
</style>
