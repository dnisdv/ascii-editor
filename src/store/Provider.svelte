<script lang="ts">
	import { setContext } from 'svelte';
	import { STORE_KEY } from './constants';
	import { createStore } from '@store/store';
	import type { Store } from 'redux';

	const store = createStore();

	export let overrideStore: Store = store;
	setContext(STORE_KEY, overrideStore);
</script>

<slot />
