<script lang="ts">
	import type { MenuItem, SubmenuMenuItem } from '@editor/context-menu';

	export let item: MenuItem;
	export let tLabel: (item: MenuItem) => string;
	export let onSelect: (item: MenuItem) => void;

	import MenuSeparator from './MenuSeparator.svelte';
	import MenuButton from './MenuButton.svelte';
	import MenuSubmenu from './MenuSubmenu.svelte';

	const btn =
		'flex w-full items-center rounded-sm px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground';
	const componentFor = (it: MenuItem) => {
		if (it.kind === 'separator') return MenuSeparator;
		if (it.kind === 'submenu') return MenuSubmenu;
		return MenuButton;
	};
</script>

<div class="group relative">
	<button class={btn}>
		{tLabel(item)}
		<span class="ml-auto">›</span>
	</button>
	<div class="absolute left-full top-0 hidden pl-1 group-hover:block">
		<div class="min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
			{#each (item as SubmenuMenuItem).items as sub, i (sub.id ?? sub.labelKey ?? sub.label ?? i)}
				<svelte:component this={componentFor(sub)} item={sub} {tLabel} {onSelect} />
			{/each}
		</div>
	</div>
</div>
