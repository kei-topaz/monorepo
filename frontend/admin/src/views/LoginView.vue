<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseInputText from '@/components/base/BaseInputText.vue'
import BasePassword from '@/components/base/BasePassword.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useAuthStore } from '@/stores/authStore'
import { useAsync } from '@/composables/useAsync'

const router = useRouter()
const auth = useAuthStore()
const { loading, execute: login } = useAsync(
  (email: string, password: string) => auth.login(email, password),
)

const email = ref('')
const password = ref('')

async function handleLogin() {
  const result = await login(email.value, password.value)
  if (result) router.push({ name: 'dashboard' })
}
</script>

<template>
  <div>
    <h1 class="login-title">관리자 패널</h1>
      <p class="login-subtitle">계정에 로그인하세요</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="email">이메일</label>
          <BaseInputText
            id="email"
            v-model="email"
            type="email"
            placeholder="admin@example.com"
            :fluid="true"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <label for="password">비밀번호</label>
          <BasePassword
            id="password"
            v-model="password"
            placeholder="비밀번호"
            :fluid="true"
            :disabled="loading"
            required
          />
        </div>

        <BaseButton
          type="submit"
          label="로그인"
          :loading="loading"
          :fluid="true"
        />
      </form>
  </div>
</template>

<style scoped>
.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 0.25rem;
}

.login-subtitle {
  color: var(--p-text-muted-color);
  margin-bottom: 1.5rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}

</style>
