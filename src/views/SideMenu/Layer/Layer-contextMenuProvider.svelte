<script context="module" lang="ts">
	import { setContext, getContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	export interface ContextMenu {
		activeMenu: Writable<string | null>;
		open: (id: string) => void;
		close: () => void;
	}

	const CONTEXT_KEY = Symbol('contextMenu');

	export function getContextMenu(): ContextMenu {
		return getContext<ContextMenu>(CONTEXT_KEY);
	}
</script>

<script lang="ts">
	const activeMenu = writable<null | string>(null);
	const contextMenu: ContextMenu = {
		activeMenu,
		open: (id: string) => activeMenu.set(id),
		close: () => activeMenu.set(null)
	};

	setContext<ContextMenu>(CONTEXT_KEY, contextMenu);
</script>

<slot />
