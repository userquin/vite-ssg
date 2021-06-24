import { Router } from 'vue-router'
import { ViteSSGContext } from '../types'

export function configureRouteBeforeEachEntryServer(router: Router, context: ViteSSGContext<true>) {
  let entryRoutePath: string | undefined
  let isFirstRoute = true
  router.beforeEach((to, from, next) => {
    if (isFirstRoute || (entryRoutePath && entryRoutePath === to.path)) {
      // The first route is rendered in the server and its state is provided globally.
      isFirstRoute = false
      entryRoutePath = to.path
      to.meta.state = context.initialState
    }

    next()
  })
}
