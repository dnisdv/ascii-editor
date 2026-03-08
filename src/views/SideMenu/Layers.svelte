<script lang="ts">
	import * as Tooltip from '@components/tooltip';
	import { ScrollArea } from '@components/scroll-area';
	import DndList from '@components/dnd-list/DndList.svelte';
	import DndListItem from '@components/dnd-list/DndListItem.svelte';
	import type { ChangeEventDetail, DraggableItem } from '@components/dnd-list';
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import LayerContextMenuProvider from './Layer/Layer-contextMenuProvider.svelte';
	import Layer from './Layer/Layer.svelte';
	import { cn } from '@lib/utils.js';
	import { useCore } from '@/config/useCore';
	import { writable } from 'svelte/store';

	const core = useCore();

	const layersManager = core.getLayersManager();
	const layers = writable(core.getLayersManager().getLayers());
	const activeLayerId = writable(core.getLayersManager().getActiveLayerKey());

	layersManager.on('layer::added', () => {
		const newLayers = core.getLayersManager().getLayers();
		layers.set(newLayers);
	});

	layersManager.on('layer::active::changed', () => {
		const newActiveLayerId = core.getLayersManager().getActiveLayerKey();
		activeLayerId.set(newActiveLayerId);
	});

	layersManager.on('layer::removed', () => {
		const newLayers = core.getLayersManager().getLayers();
		layers.set(newLayers);
	});

	const onChange = (e: CustomEvent<ChangeEventDetail>) => {
		const toIndex = e.detail.toIndex;
		const layer = e.detail.fromItem;
		layersManager.updateLayer(layer.id, { index: toIndex });
		const newLayers = core.getLayersManager().getLayers();
		layers.set(newLayers);
	};

	const addNewLayer = () => {
		const layersManager = core.getLayersManager();
		layersManager.addLayer();
	};

	const onContextMenu = (e: Event) => {
		e.preventDefault();
	};

	const handleScroll = () => {};

	type $$Props = {
		class?: string;
	};

	let className: $$Props['class'] = undefined;
	export { className as class };

	$: sortedLayers = [...$layers].sort((a, b) => a.index - b.index);
</script>

<div
	role="menu"
	tabindex="0"
	on:contextmenu={onContextMenu}
	class={cn('h-full select-none', className)}
>
	<LayerContextMenuProvider>
		<div class="flex items-center justify-between pl-3 pr-1.5">
			<h2 class="text-xs font-medium">Layers</h2>
			<Tooltip.Root>
				<Tooltip.Trigger asChild let:builder>
					<Button builders={[builder]} on:click={addNewLayer} variant="ghost" size="icon-xxs"
						><IconLoader name="plus" /></Button
					>
				</Tooltip.Trigger>

				<Tooltip.Content>Add new layer</Tooltip.Content>
			</Tooltip.Root>
		</div>

		<ScrollArea hideDelay={0} onScroll={handleScroll} class="flex h-full flex-col overflow-y-auto">
			<div class="px-1.5 pb-1.5 pt-1.5">
				<DndList on:change={onChange} itemHeight={28}>
					{#each sortedLayers as layer (layer.id)}
						<DndListItem
							item={layer as unknown as DraggableItem}
							let:isBeingDragged
							let:isSomethingDragging
						>
							<div class=" w-full items-center">
								<Layer
									id={layer.id}
									{layer}
									{isSomethingDragging}
									dragging={isBeingDragged}
									active={String($activeLayerId) === String(layer.id)}
								/>
							</div>
						</DndListItem>
					{/each}
				</DndList>
			</div>
		</ScrollArea>
	</LayerContextMenuProvider>
</div>
