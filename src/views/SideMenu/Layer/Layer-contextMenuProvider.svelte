<script context="module" lang="ts">
	import { setContext, getContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	export interface ContextMenu {
		activeMenu: Writable<string | null>;
		open: (id: string) => void;
		close: () => void;
		registerObjectStore: (store: Writable<number | null>) => () => void;
		closeAllObjects: () => void;
	}

	const CONTEXT_KEY = Symbol('contextMenu');

	export function getContextMenu(): ContextMenu {
		return getContext<ContextMenu>(CONTEXT_KEY);
	}
</script>

<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	const activeMenu = writable<null | string>(null);
	const objectStores = new SvelteSet<Writable<number | null>>();

	function closeAllObjects() {
		objectStores.forEach((s) => s.set(null));
	}

	const contextMenu: ContextMenu = {
		activeMenu,
		open: (id: string) => {
			activeMenu.set(id);
			closeAllObjects();
		},
		close: () => activeMenu.set(null),
		registerObjectStore: (store: Writable<number | null>) => {
			objectStores.add(store);
			return () => objectStores.delete(store);
		},
		closeAllObjects
	};

	setContext<ContextMenu>(CONTEXT_KEY, contextMenu);
</script>

<slot />
