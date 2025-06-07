<script lang="ts">
	import { setContext } from 'svelte';
	import { readable } from 'svelte/store';
	import type { Config } from '../editor/config';
	import { EDITOR_CONFIG_CONTEXT_KEY } from './constants';
	export let config: Config;

	const configStore = readable(config, (set) => {
		const onChanged = () => set(config);
		config.on('changed', onChanged);
		return () => {
			config.off('changed', onChanged);
		};
	});

	setContext(EDITOR_CONFIG_CONTEXT_KEY, {
		config,
		configStore
	});
</script>

<slot />
