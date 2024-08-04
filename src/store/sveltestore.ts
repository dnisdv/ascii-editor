import { writable } from "svelte/store";

export function svelteStoreEnhancer(createStoreApi: any) {
  return function(reducer: any, initialState: any) {
    const reduxStore = createStoreApi(reducer, initialState);
    const svelteStore = writable(reduxStore.getState());

    reduxStore.subscribe(() => {
      svelteStore.set(reduxStore.getState());
    });

    return {
      ...reduxStore,
      svelteStore
    };
  };
}
