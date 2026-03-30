import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type User, getSavedUser, saveAuth, logout as logoutService, login as loginService } from '@/services/authService'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(getSavedUser())

  const isAuthenticated = computed(() => !!user.value)
  const email = computed(() => user.value?.email ?? '')
  const authority = computed(() => user.value?.authority ?? '')

  async function login(email: string, password: string) {
    const response = await loginService({ email, password })
    saveAuth(response)
    user.value = response.user
    return response
  }

  async function logout() {
    await logoutService()
    user.value = null
  }

  return { user, isAuthenticated, email, authority, login, logout }
})
