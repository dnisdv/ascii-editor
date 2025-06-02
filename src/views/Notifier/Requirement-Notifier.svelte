<script lang="ts">
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	export let description: string;
</script>

<div>
	<ThemeIcon name="eye-closed" />
	{description}
</div>
