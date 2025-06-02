import { writable } from 'svelte/store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function svelteStoreEnhancer(createStoreApi: any) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function (reducer: any, initialState: any) {
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
