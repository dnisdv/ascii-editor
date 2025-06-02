<script lang="ts">
	import { useSelector } from '@store/useSelector';
	import type { RootState } from '@store/store';
	import * as Tooltip from '@components/tooltip';
	import { ScrollArea } from '@components/scroll-area';
	import DndList from '@components/dnd-list/DndList.svelte';
	import DndListItem from '@components/dnd-list/DndListItem.svelte';
	import type { ChangeEventDetail } from '@components/dnd-list';
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import LayerContextMenuProvider from './Layer/Layer-contextMenuProvider.svelte';
	import Layer from './Layer/Layer.svelte';
	import { useLayerBus } from '@/bus';
	import { cn } from '@lib/utils.js';

	const layers = useSelector((store: RootState) => store.layers.data);
	const currentLayer = useSelector((store: RootState) => store.layers.activeLayer);

	const layerBus = useLayerBus();

	const onChange = (e: CustomEvent<ChangeEventDetail>) => {
		const toIndex = e.detail.toIndex;
		const layer = e.detail.fromItem;
		layerBus.emit('layer::update::request', { id: layer.id, index: toIndex });
	};

	const addNewLayer = () => {
		layerBus.emit('layer::create::request');
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

	$: sortedLayers = Object.entries($layers)
		.map(([, layer]) => ({ ...layer }))
		.sort((a, b) => a.index - b.index);
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
						<DndListItem item={layer} let:isBeingDragged let:isSomethingDragging>
							<div class="flex h-7 max-h-7 min-h-7 w-full items-center">
								<Layer
									id={layer.id}
									{layer}
									{isSomethingDragging}
									dragging={isBeingDragged}
									active={String($currentLayer) === String(layer.id)}
								/>
							</div>
						</DndListItem>
					{/each}
				</DndList>
			</div>
		</ScrollArea>
	</LayerContextMenuProvider>
</div>
