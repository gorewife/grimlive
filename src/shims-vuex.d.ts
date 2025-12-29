declare module 'vuex' {
  import type {
    Store,
    StoreOptions,
    Module,
    Plugin,
    ActionContext,
    Commit,
    Dispatch
  } from 'vuex/types/index';
  
  export * from 'vuex/types/index';
  export function createStore<S>(options: StoreOptions<S>): Store<S>;
  export function useStore<S = any>(): Store<S>;
}
