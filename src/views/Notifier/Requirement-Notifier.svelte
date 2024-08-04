<script lang="ts">
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { onMount } from 'svelte';

	export let description: string;
	export let action: unknown;
</script>

<div>
	<ThemeIcon name="eye-closed" />
	{description}
</div>
