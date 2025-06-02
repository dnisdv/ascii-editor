import type { Dispatch, Store } from 'redux';
import { STORE_KEY } from './constants';
import { getContext } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDispatch<T = unknown>(): Dispatch<any> {
	const store: Store<T> = getContext(STORE_KEY);
	return store?.dispatch;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDispatch = (store: Store): Dispatch<any> => {
	return store.dispatch;
};
