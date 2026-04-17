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

	export let layer: ILayerModel;
	export let id: string;
	export let dragging = false;
	export let active = false;
	export let selected = false;
	export let isSomethingDragging = false;
	export let onLayerClick: ((e: MouseEvent) => void) | undefined = undefined;

	type ObjectWithMeta = ISmartObject & { index: number; __isSelected: boolean; [key: string]: unknown };

	let editableText: EditableText;
	const isEditing = writable(false);
	const objects = writable(buildObjectsList());
	const empty = writable(layersManager.getLayer(layer.id)?.isEmpty() ?? true);

	function buildObjectsList(): ObjectWithMeta[] {
		const apiLayer = layersManager.getLayer(layer.id);
		if (!apiLayer) return [];

		const composition = layersManager.getLayerComposition(layer.id);
		const tempIds = new Set(composition.slice(1).flatMap((l) => l.getObjects().map((o) => o.id)));

		return apiLayer.getObjects().map((object, index) => {
			const obj = object as ObjectWithMeta;
			obj.index = index;
			obj.__isSelected = tempIds.has(object.id);
			return obj;
		});
	}

	function refreshObjects() {
		objects.set(buildObjectsList());
		refreshEmpty();
	}

	function refreshEmpty() {
		empty.set(layersManager.getLayer(layer.id)?.isEmpty() ?? true);
	}

	layersManager.on('layer::object::added', refreshObjects);
	layersManager.on('layer::object::removed', refreshObjects);
	layersManager.on('layer::object::moved', refreshObjects);
	layersManager.on('layer::object::update', refreshObjects);

	layersManager.on('temp_layer::object::added', refreshObjects);
	layersManager.on('temp_layer::object::removed', refreshObjects);
	layersManager.on('temp_layer::object::moved', refreshObjects);
	layersManager.on('temp_layer::object::update', refreshObjects);
	layersManager.on('temp_layer::added', refreshObjects);
	layersManager.on('temp_layer::removed', refreshObjects);

	layersManager.on('layer::object::op', refreshEmpty);
	layersManager.on('temp_layer::object::op', refreshEmpty);

	const setActiveLayer = (e: MouseEvent) => {
		if (onLayerClick) onLayerClick(e);
		else layersManager.setActiveLayer(layer.id);
	};

	const startLayerRename = () => editableText.startEditing();

	const nameChange = (e: { value: string }) => {
		if (e.value.trim() === '') return;
		layersManager.updateLayer(layer.id, { name: e.value });
	};

	const remove = () => layersManager.removeLayer(layer.id);

	const toggleLayerVisibility = () => {
		const current = layersManager.getLayer(layer.id)?.getOpts().visible ?? true;
		layersManager.updateLayer(layer.id, { opts: { visible: !current } });
	};

	const editableTextChange = (e: { isEditing: boolean }) => isEditing.set(e.isEditing);

	const onOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			open(id);
		} else {
			close();
		}
	};

	const handleObjectReorder = (e: CustomEvent) => {
		const { fromItem, toIndex } = e.detail;
		if (fromItem) layersManager.moveLayerObject(layer.id, fromItem.id, toIndex);
	};

	$: layerName = layer.name;
	$: isOpen = $activeMenu === id;
	$: isVisible = layer.opts.visible;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
	$: sortedObjects = $objects ? [...$objects].sort((a, b) => a.index - b.index) : [];
</script>

<LayerContextMenu
	{isOpen}
	{onOpenChange}
	{visibleIcon}
	onRename={startLayerRename}
	onToggleVisibility={toggleLayerVisibility}
	onDelete={remove}
>
	<div
		tabindex="0"
		role="button"
		on:click={setActiveLayer}
		on:keyup|preventDefault
		class="layer h-full outline-none"
		class:dragging
		class:active
		class:selected
		class:isSomethingDragging
	>
		<div class="icon">
			<ThemeIcon name={$empty ? 'file' : 'file-type'} size={16} />
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
				class="actions ml-1 flex gap-2 outline-none"
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
		<div class="pl-3 pr-1.5 py-1">
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
									active={false}
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

		&.selected:not(.active) {
			@apply bg-primary bg-opacity-10;

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
