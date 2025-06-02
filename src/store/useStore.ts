import { getContext } from 'svelte';
import { STORE_KEY } from './constants';
import type { AppStore } from './store';

export const useStore = (): AppStore => {
	const store: AppStore = getContext(STORE_KEY);
	return store;
};
