<script lang="ts">
	import { setContext } from 'svelte';
	import type { CoreApi } from '@editor/core';
	import { EDITOR_CORE_CONTEXT_KEY } from './constants';

	export let coreApi: CoreApi;

	setContext(EDITOR_CORE_CONTEXT_KEY, coreApi);
</script>

<slot />
