const productionBaseUrl = process.env.NUXT_APP_BASE_URL || "/"
const appBaseUrl = process.env.NODE_ENV === "production" ? productionBaseUrl : "/"

export default defineNuxtConfig({
  compatibilityDate: "2025-11-01",
  devtools: {
    enabled: true
  },
  ssr: false,
  buildDir: ".nuxt",
  vite: {
    cacheDir: ".nuxt/vite-cache"
  },
  app: {
    baseURL: appBaseUrl,
    head: {
      title: "Horse Racing Trial Day",
      meta: [
        {
          name: "description",
          content: "Interactive horse racing game built with Nuxt 4."
        }
      ]
    }
  }
})
