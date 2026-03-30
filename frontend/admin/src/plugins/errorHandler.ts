import type { App } from 'vue'
import { useToast } from 'primevue/usetoast'
import errorCodes from '@/assets/errorCodes.json'
import errorMessages from '@/assets/errorMessages.ko.json'
import router from '@/router'

const messages = errorMessages as Record<string, string>
const knownCodes = new Set<string>(errorCodes)

export function setupErrorHandler(app: App) {
  app.config.errorHandler = (error) => {
    handleError(error)
  }

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault()
    handleError(event.reason)
  })

  window.addEventListener('async-error', ((event: CustomEvent) => {
    handleError(event.detail)
  }) as EventListener)
}

function getErrorCode(error: unknown): string {
  if (error instanceof Error && knownCodes.has(error.message)) {
    return error.message
  }
  return 'UNKNOWN_ERROR'
}

function handleError(error: unknown) {
  const code = getErrorCode(error)

  if (code === 'AUTH_UNAUTHENTICATED') {
    router.push({ name: 'login' })
  }

  showToast(messages[code] ?? messages['UNKNOWN_ERROR'])
}

let toastInstance: ReturnType<typeof useToast> | null = null

export function setToastInstance(toast: ReturnType<typeof useToast>) {
  toastInstance = toast
}

function showToast(message: string) {
  if (toastInstance) {
    toastInstance.add({
      severity: 'error',
      summary: '오류',
      detail: message,
      life: 5000,
    })
  } else {
    console.error(message)
  }
}
