import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'
import { setupPrimeVue } from '@/plugins/primevue'
import { setupErrorHandler } from '@/plugins/errorHandler'
import ToastService from 'primevue/toastservice'

const app = createApp(App)

app.use(createPinia())
setupPrimeVue(app)
app.use(router)
app.use(ToastService)
setupErrorHandler(app)

app.mount('#app')
