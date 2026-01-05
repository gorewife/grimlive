declare module "vuex" {
  import type { Store, StoreOptions } from "vuex/types/index";

  export * from "vuex/types/index";
  export function createStore<S>(options: StoreOptions<S>): Store<S>;
  export function useStore<S = any>(): Store<S>;
}
