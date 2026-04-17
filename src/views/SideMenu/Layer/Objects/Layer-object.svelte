<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';

	import { writable } from 'svelte/store';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { getContextMenu } from './Layer-object-contextMenuProvider.svelte';
	import LayerObjectContextMenu from './Layer-object-contextMenu.svelte';
	import { useCore } from '@/config/useCore';
	import type { LayerController } from '@editor/layers/layer-api';

	const { activeMenu, open, close } = getContextMenu();

	const core = useCore();
	const selectionManager = core.getSelectionManager();

	export let dragging = false;
	export let active = false;
	export let isSomethingDragging = false;

	let isEmpty = false;

	export let object;
	export let id;
	export let layerId: string;

	$: isTextGrid = object?.type === 'text-grid';

	const currentLayer = writable<LayerController | null>(null);
	const isEditing = writable(false);

	const handleRangeSelection = () => {
		const activeLayer = core.getLayersManager().getLayer(layerId);
		if (!activeLayer) return;

		const objects = activeLayer.getObjects();
		const session = selectionManager.getActiveSession();
		const selectedObjects = session ? session.getSelectedObjects() : [];

		if (selectedObjects.length === 0) {
			selectionManager.selectSmartObjects([object]);
			return;
		}

		const lastSelected = selectedObjects[selectedObjects.length - 1];
		const lastIdx = objects.findIndex((o) => o.id === lastSelected.id);
		const currentIdx = objects.findIndex((o) => o.id === object.id);

		if (lastIdx !== -1 && currentIdx !== -1) {
			const start = Math.min(lastIdx, currentIdx);
			const end = Math.max(lastIdx, currentIdx);
			const range = objects.slice(start, end + 1);
			selectionManager.appendSmartObjects(range);
		} else {
			selectionManager.appendSmartObjects([object]);
		}
	};

	const handleToggleSelection = () => {
		const session = selectionManager.getActiveSession();
		const isSelected = session?.getSelectedObjects().some((o) => o.id === object.id);

		if (isSelected) {
			selectionManager.deselectSmartObjects([object.id]);
		} else {
			selectionManager.appendSmartObjects([object]);
		}
	};

	const selectObject = (e?: MouseEvent) => {
		const activeLayerId = core.getLayersManager().getActiveLayerKey();
		if (activeLayerId !== layerId) return;

		if (!object || object.capabilities?.canSelect === false) return;

		if (e?.shiftKey) {
			handleRangeSelection();
		} else if (e?.ctrlKey || e?.metaKey) {
			handleToggleSelection();
		} else {
			selectionManager.selectSmartObjects([object]);
		}
	};

	const onOpenChange = (isOpen: boolean) => {
		if (isOpen) return open(id);
		close();
	};

	let editableText: EditableText;

	const startLayerRename = () => {
		if (isTextGrid) return;
		editableText.startEditing();
	};

	const nameChange = (e: { value: string }) => {
		if (isTextGrid) return;
		if (e.value.trim() === '') return;
		const newName = e.value;
		core.getLayersManager().renameObject(layerId, object.id, newName);
	};

	const remove = () => {
		if (isTextGrid) return;
		const session = selectionManager.getActiveSession();
		const isInSelection = !!session?.getSelectedObjects().some((o) => o.id === object?.id);
		if (isInSelection) {
			selectionManager.removeSelection();
			return;
		}
		core.getLayersManager().removeLayerObject(layerId, object.id);
	};

	const copyName = () => {
		const navigator = window.navigator;
		if (navigator.clipboard) {
			navigator.clipboard.writeText(object.getName());
		}
	};

	const toggleLayerVisibility = () => {};

	const editableTextChange = (e: { isEditing: boolean }) => {
		isEditing.set(e.isEditing);
	};

	$: isOpen = $activeMenu === id;
	$: isVisible = $currentLayer?.opts?.visible ?? true;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
</script>

<LayerObjectContextMenu
	{isOpen}
	{onOpenChange}
	{visibleIcon}
	on:rename={startLayerRename}
	on:copyName={copyName}
	on:toggleVisibility={toggleLayerVisibility}
	on:delete={remove}
>
	<div
		tabindex="0"
		role="button"
		on:click={selectObject}
		on:keyup|preventDefault
		class="layer h-full outline-none"
		class:dragging
		class:active
		class:isSomethingDragging
	>
		<div class="icon">
			<ThemeIcon name={isEmpty ? 'file' : 'file-type'} size={16} />
		</div>
		{#if isTextGrid}
			<span class="pl-1 text-xs opacity-50">{object.getName()}</span>
		{:else}
			<EditableText
				onBlur={nameChange}
				onToggled={editableTextChange}
				bind:this={editableText}
				class="pl-1 text-xs"
				value={object.getName()}
			/>
		{/if}
	</div>
</LayerObjectContextMenu>

<style lang="postcss">
	.layer {
		@apply relative z-10 grid h-full w-full cursor-default items-center overflow-hidden rounded-md border-none bg-none px-1 py-1;
		grid-template-columns: 1rem 1fr;

		&:not(.active):not(.isSomethingDragging):hover {
			@apply bg-secondary;

			& .icon {
				@apply opacity-100;
			}
		}

		& .icon {
			@apply opacity-50;
		}

		&.active {
			@apply bg-primary bg-opacity-20;

			& .icon {
				@apply opacity-100;
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
</style>
