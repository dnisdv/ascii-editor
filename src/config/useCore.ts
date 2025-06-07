import { getContext } from 'svelte';
import type { CoreApi } from '@editor/core';
import { EDITOR_CORE_CONTEXT_KEY } from './constants';

export const useCore = (): CoreApi => {
	const context = getContext<CoreApi>(EDITOR_CORE_CONTEXT_KEY);
	if (!context) {
		throw new Error('`useCore()` must be used within a `<CoreProvider />`');
	}
	return context;
};
