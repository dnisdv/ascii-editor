<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { Button } from '@components/button';

	import { getContextMenu } from './Layer-contextMenuProvider.svelte';
	import LayerContextMenu from './Layer-contextMenu.svelte';
	import { writable } from 'svelte/store';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { useCore } from '@/config/useCore';
	import ScrollArea from '@components/scroll-area/scroll-area.svelte';
	import DndList from '@components/dnd-list/DndList.svelte';
	import DndListItem from '@components/dnd-list/DndListItem.svelte';
	import LayerObject from './Objects/Layer-object.svelte';
	import LayerObjectContextMenuProvider from './Objects/Layer-object-contextMenuProvider.svelte';
	import type { ILayerModel } from '@editor/types/external/layer-model';
	import type { ISmartObject } from '@editor/objects/smart-object.interface';

	const core = useCore();
	const layersManager = core.getLayersManager();

	const { activeMenu, open, close } = getContextMenu();

	export let dragging = false;
	export let active = false;
	export let isSomethingDragging = false;

	let isEmpty = false;

	export let layer: ILayerModel;
	export let id: string;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type ObjectWithMeta = ISmartObject & { index: number; __isSelected: boolean; [key: string]: any };

	function buildObjectsList(): ObjectWithMeta[] {
		const apiLayer = layersManager.getLayer(layer.id);
		if (!apiLayer) return [];

		const composition = layersManager.getLayerComposition(layer.id);
		const tempIds = new Set(composition.slice(1).flatMap((l) => l.getObjects().map((o) => o.id)));

		return apiLayer.getObjects().map((object, index) => {
			const objWithMeta = object as ObjectWithMeta;
			objWithMeta.index = index;
			objWithMeta.__isSelected = tempIds.has(object.id);
			return objWithMeta;
		});
	}

	const objects = writable(buildObjectsList());
	const currentLayer = writable<string | null>(null);
	const isEditing = writable(false);

	function refreshObjects() {
		objects.set(buildObjectsList());
		isEmpty = layersManager.getLayer(layer.id)?.isEmpty() ?? true;
	}

	// Real layer events
	layersManager.on('layer::object::added', refreshObjects);
	layersManager.on('layer::object::removed', refreshObjects);
	layersManager.on('layer::object::moved', refreshObjects);
	layersManager.on('layer::object::update', refreshObjects);

	// Temp layer events (selected overlays)
	layersManager.on('temp_layer::object::added', refreshObjects);
	layersManager.on('temp_layer::object::removed', refreshObjects);
	layersManager.on('temp_layer::object::moved', refreshObjects);
	layersManager.on('temp_layer::object::update', refreshObjects);

	layersManager.on('temp_layer::added', refreshObjects);
	layersManager.on('temp_layer::removed', refreshObjects);

	layersManager.on('layer::updated', () => {
		isVisible = layersManager.getLayer(layer.id)?.getOpts().visible ?? true;
	});

	layersManager.on('layer::object::op',() => {
		isEmpty = layersManager.getLayer(layer.id)?.isEmpty() ?? true;
	})

	const setActiveLayer = () => {
		core.getLayersManager().setActiveLayer(layer.id);
	};

	const onOpenChange = (isOpen: boolean) => {
		if (isOpen) return open(id);
		close();
	};

	let editableText: EditableText;

	const startLayerRename = () => {
		editableText.startEditing();
	};

	const nameChange = (e: { value: string }) => {
		if (e.value.trim() === '') return;
		const newName = e.value;
		const layersManager = core.getLayersManager();
		layersManager.updateLayer(layer.id, { name: newName });
	};

	const remove = () => {
		core.getLayersManager().removeLayer(layer.id);
	};

	const copyName = () => {
		const navigator = window.navigator;
		if (navigator.clipboard) {
			navigator.clipboard.writeText(layer.name);
		}
	};

	const toggleLayerVisibility = () => {
		const current = layersManager.getLayer(layer.id)?.getOpts().visible ?? true;
		layersManager.updateLayer(layer.id, { opts: { visible: !current } });
	};

	const editableTextChange = (e: { isEditing: boolean }) => {
		isEditing.set(e.isEditing);
	};

	const handleObjectReorder = (e: CustomEvent) => {
		const { fromItem, toIndex } = e.detail;
		if (fromItem) layersManager.moveLayerObject(layer.id, fromItem.id, toIndex);
	};

	$: layerName = layer.name;
	$: isOpen = $activeMenu === id;
	$: isVisible = layer.opts.visible;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
	$: isEmpty = core.getLayersManager()?.getLayer(layer.id)?.isEmpty() || false;

	$: sortedObjects = $objects ? [...$objects].sort((a, b) => a.index - b.index) : [];
</script>

<LayerContextMenu
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
		on:click={setActiveLayer}
		on:keyup|preventDefault
		class="layer h-full"
		class:dragging
		class:active
		class:isSomethingDragging
	>
		<div class="icon">
			<ThemeIcon name={isEmpty ? 'file' : 'file-type'} size={16} />
		</div>
		<EditableText
			onBlur={nameChange}
			onToggled={editableTextChange}
			bind:this={editableText}
			class="pl-1 text-xs"
			value={layerName}
		/>
		{#if !$isEditing}
			<div
				on:mousedown|stopPropagation
				class="actions ml-1 flex gap-2"
				class:always-visible={!isVisible}
				role="button"
				tabindex="0"
			>
				<Button
					on:click={(e) => {
						e.stopPropagation();
						toggleLayerVisibility();
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
</LayerContextMenu>

<LayerObjectContextMenuProvider>
	<ScrollArea onScroll={() => {}} hideDelay={0} class="flex h-full flex-col overflow-y-auto">
		<div class="px-1.5 pb-1.5 pt-1.5">
			<DndList on:change={handleObjectReorder}>
				{#each sortedObjects as object (object.id)}
					<DndListItem item={object} let:isBeingDragged let:isSomethingDragging>
						<div class="flex items-center">
							<div class:selection-active={object.__isSelected} class="w-full rounded-sm">
								<LayerObject
									layerId={layer.id}
									id={object.id}
									{isSomethingDragging}
									{object}
									dragging={isBeingDragged}
									active={String($currentLayer) === String(layer.id)}
								/>
							</div>
						</div>
					</DndListItem>
				{/each}
			</DndList>
		</div>
	</ScrollArea>
</LayerObjectContextMenuProvider>

<style lang="postcss">
	.layer {
		@apply relative z-10 grid h-full w-full cursor-default items-center overflow-hidden rounded-md border-none bg-none px-1 py-1;
		grid-template-columns: 1rem 1fr auto;

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

	.selection-active {
		@apply bg-blue-500/30;
	}
</style>
