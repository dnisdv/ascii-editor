<script lang="ts">
	import type { MenuItem } from '@editor/context-menu';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	export let item: MenuItem;
	export let tLabel: (item: MenuItem) => string;
	export let onSelect: (item: MenuItem) => void;

	const baseBtn =
		'flex w-full items-center rounded-sm px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50';

	const isDisabled = (it: MenuItem) => ('enabled' in it ? it.enabled === false : false);
</script>

<button class={baseBtn} disabled={isDisabled(item)} on:click={() => onSelect(item)}>
	{#if item.kind === 'toggle' || item.kind === 'radio'}
		<div class="mr-2 flex w-4 items-center justify-center">
			{#if (item.kind === 'toggle' && item.checked === true) || (item.kind === 'radio' && item.selected)}
				<ThemeIcon name="check" size={14} />
			{:else if item.kind === 'toggle' && item.checked === 'mixed'}
				<ThemeIcon name="minus" size={14} />
			{/if}
		</div>
	{/if}
	{tLabel(item)}
	{#if 'shortcut' in item && item.shortcut}
		<span class="ml-auto pl-4 text-xs opacity-50">{item.shortcut}</span>
	{/if}
</button>
