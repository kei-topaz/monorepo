import { ref, type Ref } from 'vue'

interface UseAsyncReturn<TArgs extends unknown[], TResult> {
  data: Ref<TResult | null>
  loading: Ref<boolean>
  error: Ref<string>
  execute: (...args: TArgs) => Promise<TResult | null>
}

export function useAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): UseAsyncReturn<TArgs, TResult> {
  const data = ref<TResult | null>(null) as Ref<TResult | null>
  const loading = ref(false)
  const error = ref('')

  async function execute(...args: TArgs): Promise<TResult | null> {
    loading.value = true
    error.value = ''

    try {
      const result = await fn(...args)
      data.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'UNKNOWN_ERROR'
      window.dispatchEvent(new CustomEvent('async-error', { detail: e }))
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, execute }
}
