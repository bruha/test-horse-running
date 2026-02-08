import { horseRaceStore } from "~/store"

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(horseRaceStore)
})
