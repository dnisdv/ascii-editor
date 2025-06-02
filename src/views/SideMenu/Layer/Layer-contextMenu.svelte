<script lang="ts">
	import { createEventDispatcher } from 'svelte';
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

	interface ComponentEvents {
		rename: void;
		toggleVisibility: void;
		delete: void;
	}

	const dispatch = createEventDispatcher<ComponentEvents>();

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
	};

	const handleRename = () => dispatch('rename');
	const handleToggleVisibility = () => dispatch('toggleVisibility');
	const handleDelete = () => dispatch('delete');
</script>

<ContextMenu open={isOpen} onOpenChange={handleOpenChange}>
	<ContextMenuTrigger class=" w-full">
		<slot />
	</ContextMenuTrigger>
	<ContextMenuContent class="z-50">
		<ContextMenuItem on:click={handleRename}>
			<div class="option">
				<ThemeIcon name="pen" />
				<span>Rename</span>
			</div>
		</ContextMenuItem>
		<ContextMenuItem on:click={handleToggleVisibility}>
			<div class="option">
				<ThemeIcon name={visibleIcon} />
				<span>Show/Hide</span>
			</div>
		</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuItem on:click={handleDelete}>
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
