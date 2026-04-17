<script lang="ts">
	import * as Tooltip from '@components/tooltip';

	export let name: string;
	export let hotkey: string;
	export let hint: string = '';
</script>

<Tooltip.Content class="flex flex-col gap-1">
	<div class="flex gap-2">
		<p class="text-xs font-medium">{name}</p>
		<p class="text-xs font-medium opacity-50">{hotkey}</p>
	</div>
	{#if hint}
		<p class="text-xs opacity-50">{hint}</p>
	{/if}
</Tooltip.Content>
