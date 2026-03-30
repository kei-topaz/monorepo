import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

export const authGuard: NavigationGuard = (to) => {
  const auth = useAuthStore()
  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
}
