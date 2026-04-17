<script context="module" lang="ts">
	import { setContext, getContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	export interface ContextMenu {
		activeMenu: Writable<number | null>;
		open: (id: number) => void;
		close: () => void;
	}

	const CONTEXT_KEY = Symbol('objects_contextMenu');

	export function getContextMenu(): ContextMenu {
		return getContext<ContextMenu>(CONTEXT_KEY);
	}
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getContextMenu as getLayerContextMenu } from '../Layer-contextMenuProvider.svelte';

	const { closeAllObjects, registerObjectStore, close: closeLayerMenu } = getLayerContextMenu();

	const activeMenu = writable<null | number>(null);

	const unregister = registerObjectStore(activeMenu);
	onDestroy(unregister);

	const contextMenu: ContextMenu = {
		activeMenu,
		open: (id: number) => {
			closeAllObjects();
			closeLayerMenu();
			activeMenu.set(id);
		},
		close: () => activeMenu.set(null)
	};

	setContext<ContextMenu>(CONTEXT_KEY, contextMenu);
</script>

<slot />
