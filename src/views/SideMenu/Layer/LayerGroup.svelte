<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { Button } from '@components/button';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { useCore } from '@/config/useCore';
	import { writable } from 'svelte/store';
	import {
		ContextMenu,
		ContextMenuContent,
		ContextMenuSeparator,
		ContextMenuTrigger
	} from '@components/context-menu';
	import ContextMenuItem from '@components/context-menu/context-menu-item.svelte';
	import type { ILayerGroup } from '@editor/types/external/layer-group';
	import { getContextMenu } from './Layer-contextMenuProvider.svelte';

	const core = useCore();
	const layersManager = core.getLayersManager();
	const { activeMenu, open: openMenu, close: closeMenu } = getContextMenu();

	export let group: ILayerGroup;
	export let dragging = false;
	export let isSomethingDragging = false;

	let editableText: EditableText;


	const isEditing = writable(false);

	$: groupName = group.name;
	$: collapsed = group.collapsed;
	$: isVisible = group.opts.visible;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
	$: folderIcon = collapsed ? 'folder' : 'folder-open';

	const toggleCollapsed = (e: MouseEvent) => {
		e.stopPropagation();
		layersManager.setGroupCollapsed(group.id, !collapsed);
	};

	const toggleGroupVisibility = () => {
		layersManager.toggleGroupVisibility(group.id);
	};

	const startGroupRename = () => {
		editableText.startEditing();
	};

	const nameChange = (e: { value: string }) => {
		if (e.value.trim() === '') return;
		layersManager.updateGroup(group.id, { name: e.value });
	};

	const removeGroup = () => {
		layersManager.removeGroup(group.id, false);
	};

	const addLayerInGroup = () => {
		layersManager.addLayerInGroup(group.id);
	};

	const editableTextChange = (e: { isEditing: boolean }) => {
		isEditing.set(e.isEditing);
	};

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			openMenu(`group::${group.id}`);
		} else {
			closeMenu();
		}
	};

	$: contextMenuOpen = $activeMenu === `group::${group.id}`;

</script>

<ContextMenu open={contextMenuOpen} onOpenChange={handleOpenChange}>
	<ContextMenuTrigger class="w-full">
		<div
			tabindex="0"
			role="button"
			on:click={toggleCollapsed}
			on:keyup|preventDefault
			class="group-header h-full outline-none"
			class:dragging
			class:isSomethingDragging
		>
			<div class="chevron outline-none" class:open={!collapsed} on:click={toggleCollapsed} role="button" tabindex="0" on:keyup|preventDefault>
				<ThemeIcon name="chevron-right" size={10} />
			</div>
			<div class="icon">
				<ThemeIcon name={folderIcon} size={16} />
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
			<div on:click|stopPropagation>
				<EditableText
					onBlur={nameChange}
					onToggled={editableTextChange}
					bind:this={editableText}
					class="pl-1 text-xs font-medium"
					value={groupName}
				/>
			</div>
			{#if !$isEditing}
				<div
					on:mousedown|stopPropagation
					class="actions ml-1 flex gap-2 outline-none"
					class:always-visible={!isVisible}
					role="button"
					tabindex="0"
				>
					<Button
						on:click={(e) => {
							e.stopPropagation();
							toggleGroupVisibility();
						}}
						class="z-50 m-0 h-auto w-auto p-0 hover:bg-none"
						variant="link"
						size="icon"
					>
						<ThemeIcon name={visibleIcon} />
					</Button>
				</div>
			{/if}
		</div>
	</ContextMenuTrigger>
	<ContextMenuContent class="z-50">
		<ContextMenuItem on:click={addLayerInGroup}>
			<div class="option">
				<ThemeIcon name="plus" />
				<span>Add layer</span>
			</div>
		</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuItem on:click={startGroupRename}>
			<div class="option">
				<ThemeIcon name="pen" />
				<span>Rename</span>
			</div>
		</ContextMenuItem>
		<ContextMenuItem on:click={toggleGroupVisibility}>
			<div class="option">
				<ThemeIcon name={visibleIcon} />
				<span>Show/Hide</span>
			</div>
		</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuItem on:click={removeGroup}>
			<div class="option">
				<ThemeIcon name="trash" />
				<span>Ungroup</span>
			</div>
		</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>

<style lang="postcss">
	.group-header {
		@apply relative z-10 grid h-full w-full cursor-default items-center overflow-visible rounded-md border-none bg-none px-1 py-1;
		grid-template-columns: 1rem 1fr auto;

		& .icon {
			@apply flex items-center justify-center opacity-50;
		}

		&:not(.isSomethingDragging):hover {
			@apply bg-secondary;
		}

		& .chevron {
			@apply absolute left-0 flex items-center justify-center transition-transform duration-150;
			transform: translateX(-100%);

			&.open {
				transform: translateX(-100%) rotate(90deg);
			}
		}

		&.dragging {
			@apply bg-primary bg-opacity-20;
		}

		& .actions {
			@apply z-50 hidden;
		}

		&:not(.isSomethingDragging):hover .actions {
			@apply flex;
		}

		& .actions.always-visible {
			@apply flex;
		}
	}

	.option {
		@apply flex gap-2 text-xs;
	}
</style>
