<script lang="ts">
	import * as Tooltip from '@components/tooltip';
	import { ScrollArea } from '@components/scroll-area';
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import LayerContextMenuProvider from './Layer/Layer-contextMenuProvider.svelte';
	import Layer from './Layer/Layer.svelte';
	import LayerGroup from './Layer/LayerGroup.svelte';
	import LayersDndTree, { type LayerFlatItem } from './LayersDndTree.svelte';
	import { cn } from '@lib/utils.js';
	import { useCore } from '@/config/useCore';
	import { writable } from 'svelte/store';
	import type { DropChange } from './layers-dnd';

	const core = useCore();
	const layersManager = core.getLayersManager();
	const layers = writable(core.getLayersManager().getLayers());
	const activeLayerId = writable(core.getLayersManager().getActiveLayerKey());
	const groups = writable(core.getLayersManager().getGroups());
	const selectedLayerIds = writable<Set<string>>(new Set(core.getLayersManager().getSelectedLayerIds()));

	let lastClickedLayerId: string | null = null;

	let suppressRefresh = false;

	function refreshAll() {
		if (suppressRefresh) return;
		layers.set(core.getLayersManager().getLayers());
		groups.set(core.getLayersManager().getGroups());
	}

	function handleDrop(changes: DropChange[]) {
		suppressRefresh = true;
		try {
			layersManager.moveLayers(changes);
		} finally {
			suppressRefresh = false;
		}
		refreshAll();
	}

	layersManager.on('layer::added', refreshAll);
	layersManager.on('layer::removed', refreshAll);
	layersManager.on('layer::updated', refreshAll);
	layersManager.on('group::added', refreshAll);
	layersManager.on('group::removed', refreshAll);
	layersManager.on('group::updated', refreshAll);

	layersManager.on('layer::active::changed', () => {
		activeLayerId.set(core.getLayersManager().getActiveLayerKey());
	});

	layersManager.on('layer::selection::changed', ({ selectedIds }) => {
		selectedLayerIds.set(new Set(selectedIds));
	});

	const addNewLayer = () => layersManager.addLayer();

	const handleLayerClick = (layerId: string, e: MouseEvent) => {
		if (e.ctrlKey || e.metaKey) {
			layersManager.toggleLayerSelection(layerId);
		} else if (e.shiftKey && (lastClickedLayerId || layersManager.getActiveLayerKey())) {
			const anchor = lastClickedLayerId || layersManager.getActiveLayerKey()!;
			layersManager.selectLayerRange(anchor, layerId);
		} else {
			layersManager.clearLayerSelection();
			layersManager.selectLayer(layerId);
			layersManager.setActiveLayer(layerId);
		}
		lastClickedLayerId = layerId;
	};

	const onContextMenu = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const onMouseUp = (e: MouseEvent) => {
		if (e.button === 2) e.stopPropagation();
	};
	const asLayerItem = (item: unknown): LayerFlatItem => item as LayerFlatItem;

	type $$Props = { class?: string };
	let className: $$Props['class'] = undefined;
	export { className as class };
</script>

<div
	role="menu"
	tabindex="0"
	on:contextmenu={onContextMenu}
	on:mouseup={onMouseUp}
	class={cn('h-full select-none', className)}
>
	<LayerContextMenuProvider>
		<div class="flex items-center justify-between pl-3 pr-1.5">
			<h2 class="text-xs font-medium">Layers</h2>
			<div class="flex gap-0.5">
				<Tooltip.Root>
					<Tooltip.Trigger asChild let:builder>
						<Button builders={[builder]} on:click={addNewLayer} variant="ghost" size="icon-xxs">
							<IconLoader name="plus" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>Add new layer</Tooltip.Content>
				</Tooltip.Root>
			</div>
		</div>

		<ScrollArea hideDelay={0} onScroll={() => {}} class="flex h-full flex-col overflow-y-auto">
			<div class="pb-1.5 pl-4 pr-1.5 pt-1.5">
				<LayersDndTree
				layers={$layers}
				groups={$groups}
				onDrop={handleDrop}
				onExpandGroup={(id) => { layersManager.setGroupCollapsed(id, false); refreshAll(); }}
				let:item
				let:isBeingDragged
				let:isDragging
			>
					{@const li = asLayerItem(item)}
					{#if li.kind === 'group-header' && li.group}
						<LayerGroup
							group={li.group}
							dragging={isBeingDragged}
							isSomethingDragging={isDragging}
						/>
					{:else if li.kind === 'layer' && li.layer}
						<Layer
							id={li.layer.id}
							layer={li.layer}
							isSomethingDragging={isDragging}
							dragging={isBeingDragged}
							active={String($activeLayerId) === String(li.layer.id)}
							selected={$selectedLayerIds.has(li.layer.id)}
							onLayerClick={(e) => handleLayerClick(li.layer?.id ?? '', e)}
						/>
					{/if}
				</LayersDndTree>
			</div>
		</ScrollArea>
	</LayerContextMenuProvider>
</div>
