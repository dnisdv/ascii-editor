<script lang="ts">
	import {
		ContextMenu,
		ContextMenuContent,
		ContextMenuSeparator,
		ContextMenuTrigger
	} from '@components/context-menu';
	import ContextMenuItem from '@components/context-menu/context-menu-item.svelte';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	export let isOpen: boolean;
	export let visibleIcon: string;
	export let onOpenChange: (isOpen: boolean) => void;

	export let onRename: (() => void) | undefined = undefined;
	export let onToggleVisibility: (() => void) | undefined = undefined;
	export let onDelete: (() => void) | undefined = undefined;

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
	};
</script>

<ContextMenu open={isOpen} onOpenChange={handleOpenChange}>
	<ContextMenuTrigger class=" w-full">
		<slot />
	</ContextMenuTrigger>
	<ContextMenuContent class="z-50">
		<ContextMenuItem on:click={() => onRename?.()}>
			<div class="option">
				<ThemeIcon name="pen" />
				<span>Rename</span>
			</div>
		</ContextMenuItem>
		<ContextMenuItem on:click={() => onToggleVisibility?.()}>
			<div class="option">
				<ThemeIcon name={visibleIcon} />
				<span>Show/Hide</span>
			</div>
		</ContextMenuItem>
		<ContextMenuSeparator />

		<ContextMenuSeparator />
		<ContextMenuItem on:click={() => onDelete?.()}>
			<div class="option">
				<ThemeIcon name="trash" />
				<span>Delete</span>
			</div>
		</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>

<style lang="postcss">
	.option {
		@apply flex gap-2 text-xs;
	}
</style>
