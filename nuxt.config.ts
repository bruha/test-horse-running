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
