import { defineStore } from 'pinia'

interface RootState {
  user: Record<string, any> | null
  message?: string
}

export const useRootStore = defineStore({
  id: 'root',
  state: (): RootState => ({
    user: null,
    message: undefined,
  }),
  getters: {
    isReady(state) {
      return !!state.user
    },
  },
  actions: {
    initialize() {
      if (this.isReady) return
      console.log('Initialize user ...')
      this.user = {
        id: 1,
        firstName: 'Jane',
        lastName: 'Doe',
      }
    },
  },
})
