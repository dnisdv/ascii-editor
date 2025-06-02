import { derived, type Readable } from 'svelte/store';
import type { AppStore, RootState } from '@store/store';
import { getContext } from 'svelte';
import { STORE_KEY } from './constants';

export const useSelector = <S>(
	selector: (state: RootState) => S,
	equalityFn: (lhs: S, rhs: S) => boolean = (lhs, rhs) => lhs === rhs
): Readable<S> => {
	let lastSelectorValue: S;

	const store = getContext(STORE_KEY) as AppStore & { svelteStore: Readable<RootState> };
	const svelteReadableStore: Readable<RootState> = store.svelteStore;

	return derived(svelteReadableStore, ($state: RootState, set) => {
		const selectorValue: S = selector($state);
		if (!equalityFn(selectorValue, lastSelectorValue)) {
			lastSelectorValue = selectorValue;
			set(lastSelectorValue);
		}
	});
};
