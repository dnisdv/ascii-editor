<script lang="ts">
	import { setContext } from 'svelte';
	import { THEME_CONTEXT_KEY } from './constants';
	import { createTheme } from './createTheme';

	setContext(THEME_CONTEXT_KEY, createTheme());
</script>

<slot />
