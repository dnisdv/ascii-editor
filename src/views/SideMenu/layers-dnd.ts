export interface LayerLike {
	id: string;
	index: number;
	groupId?: string | null;
}

export interface GroupLike {
	id: string;
	index: number;
	parentId: string | null;
	collapsed?: boolean;
}

export type FlatItem = {
	id: string;
	kind: 'layer' | 'group-header';
	depth: number;
	parentGroupId: string | null;
	collapsed?: boolean;
};

export type DropChange = {
	id: string;
	kind: 'layer' | 'group';
	newParentId?: string | null;
	newIndex: number;
};

type MergedEntry =
	| { index: number; type: 'group'; data: GroupLike }
	| { index: number; type: 'layer'; data: LayerLike };

function mergeChildren(
	allLayers: LayerLike[],
	allGroups: GroupLike[],
	parentId: string | null
): MergedEntry[] {
	const groups: MergedEntry[] = allGroups
		.filter((g) => g.parentId === parentId)
		.map((g) => ({ index: g.index, type: 'group' as const, data: g }));

	const layers: MergedEntry[] = allLayers
		.filter((l) => (l.groupId ?? null) === parentId)
		.map((l) => ({ index: l.index, type: 'layer' as const, data: l }));

	return [...groups, ...layers].sort((a, b) => a.index - b.index);
}

function flatItemFromGroup(group: GroupLike, depth: number, parentId: string | null): FlatItem {
	return { id: group.id, kind: 'group-header', depth, parentGroupId: parentId, collapsed: group.collapsed };
}

function flatItemFromLayer(layer: LayerLike, depth: number, parentId: string | null): FlatItem {
	return { id: layer.id, kind: 'layer', depth, parentGroupId: parentId };
}

export function buildFlatList(
	parentId: string | null,
	allLayers: LayerLike[],
	allGroups: GroupLike[],
	depth: number = 0
): FlatItem[] {
	const items: FlatItem[] = [];

	for (const entry of mergeChildren(allLayers, allGroups, parentId)) {
		if (entry.type === 'group') {
			items.push(flatItemFromGroup(entry.data, depth, parentId));
			if (!entry.data.collapsed) {
				items.push(...buildFlatList(entry.data.id, allLayers, allGroups, depth + 1));
			}
		} else {
			items.push(flatItemFromLayer(entry.data, depth, parentId));
		}
	}

	return items;
}

function dropKind(kind: FlatItem['kind']): DropChange['kind'] {
	return kind === 'layer' ? 'layer' : 'group';
}

function buildWorkList(flatList: FlatItem[], sourceIndex: number, insertAt: number, newParentId: string | null): FlatItem[] {
	const source = flatList[sourceIndex];
	const list = flatList.filter((_, i) => i !== sourceIndex);
	list.splice(insertAt, 0, { ...source, parentGroupId: newParentId });
	return list;
}

function buildSourceChange(source: FlatItem, newParentId: string | null): DropChange {
	const change: DropChange = { id: source.id, kind: dropKind(source.kind), newIndex: 0 };
	if (newParentId !== source.parentGroupId) {
		change.newParentId = newParentId;
	}
	return change;
}

function reindexScope(workList: FlatItem[], scopeId: string | null, changeMap: Map<string, DropChange>): void {
	let idx = 0;
	for (const item of workList) {
		if (item.parentGroupId !== scopeId) continue;
		const existing = changeMap.get(item.id);
		if (existing) {
			existing.newIndex = idx;
		} else {
			changeMap.set(item.id, { id: item.id, kind: dropKind(item.kind), newIndex: idx });
		}
		idx++;
	}
}

export function computeDropChanges(
	flatList: FlatItem[],
	sourceIndex: number,
	insertAt: number,
	newParentId: string | null
): DropChange[] {
	const source = flatList[sourceIndex];
	const workList = buildWorkList(flatList, sourceIndex, insertAt, newParentId);

	const changeMap = new Map<string, DropChange>();
	changeMap.set(source.id, buildSourceChange(source, newParentId));
	reindexScope(workList, newParentId, changeMap);

	return [...changeMap.values()];
}
