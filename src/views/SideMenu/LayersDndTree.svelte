<script context="module" lang="ts">
	import type { Layer } from '@editor/layers/layer';
	import type { ILayerGroup } from '@editor/types/external/layer-group';
	import type { FlatItem } from './layers-dnd';

	export type LayerFlatItem = FlatItem & {
		layer?: Layer;
		group?: ILayerGroup;
	};
</script>

<script lang="ts">
	import DndTreeList from '@components/dnd-list/DndTreeList.svelte';
	import {
		buildFlatList as buildFlatListPure,
		computeDropChanges,
		type DropChange
	} from './layers-dnd';

	export let layers: Layer[] = [];
	export let groups: ILayerGroup[] = [];

	export let onDrop: ((changes: DropChange[]) => void) | undefined = undefined;

	export let onExpandGroup: ((groupId: string) => void) | undefined = undefined;

	function buildFlatList(
		parentId: string | null,
		allLayers: Layer[],
		allGroups: ILayerGroup[],
		depth = 0
	): LayerFlatItem[] {
		return buildFlatListPure(parentId, allLayers, allGroups, depth).map((item) =>
			item.kind === 'group-header'
				? { ...item, group: allGroups.find((g) => g.id === item.id) }
				: { ...item, layer: allLayers.find((l) => l.id === item.id) }
		);
	}

	function isDescendantGroup(candidateId: string | null, ancestorId: string): boolean {
		if (!candidateId) return false;
		if (candidateId === ancestorId) return true;
		const g = groups.find((x) => x.id === candidateId);
		if (!g?.parentId) return false;
		return isDescendantGroup(g.parentId, ancestorId);
	}

	function validateDrop(sourceItem: FlatItem, newParentId: string | null): boolean {
		if (sourceItem.kind === 'group-header' && newParentId !== null) {
			return newParentId !== sourceItem.id && !isDescendantGroup(newParentId, sourceItem.id);
		}
		return true;
	}

	function handleDrop(detail: { sourceIndex: number; insertAt: number; parentId: string | null }) {
		onDrop?.(computeDropChanges(flatList, detail.sourceIndex, detail.insertAt, detail.parentId));
	}

	const asLayerItem = (item: FlatItem): LayerFlatItem => item as LayerFlatItem;

	$: flatList = buildFlatList(null, layers, groups);
</script>

<DndTreeList
	items={flatList}
	{validateDrop}
	onChange={handleDrop}
	onExpandCollapsed={onExpandGroup}
	let:item
	let:isBeingDragged
	let:isDragging
>
	<slot item={asLayerItem(item)} {isBeingDragged} {isDragging} />
</DndTreeList>
