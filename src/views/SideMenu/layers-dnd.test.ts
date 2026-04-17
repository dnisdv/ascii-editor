import { describe, it, expect } from 'vitest';
import { buildFlatList, computeDropChanges } from './layers-dnd';
import type { FlatItem, GroupLike, LayerLike } from './layers-dnd';

function layer(id: string, index: number, groupId: string | null = null): LayerLike {
	return { id, index, groupId };
}

function group(
	id: string,
	index: number,
	parentId: string | null = null,
	collapsed = false
): GroupLike {
	return { id, index, parentId, collapsed };
}

function slim(items: FlatItem[]): Array<Pick<FlatItem, 'id' | 'kind' | 'depth' | 'parentGroupId'>> {
	return items.map(({ id, kind, depth, parentGroupId }) => ({ id, kind, depth, parentGroupId }));
}

describe('buildFlatList', () => {
	describe('empty inputs', () => {
		it('returns [] when no layers and no groups exist', () => {
			expect(buildFlatList(null, [], [])).toEqual([]);
		});
	});

	describe('root-level layers only', () => {
		it('returns layers sorted by index ascending', () => {
			const layers = [layer('A', 2), layer('B', 0), layer('C', 1)];
			const result = slim(buildFlatList(null, layers, []));
			expect(result.map((i) => i.id)).toEqual(['B', 'C', 'A']);
		});

		it('all items have depth 0 and parentGroupId null', () => {
			const layers = [layer('A', 0), layer('B', 1)];
			const result = slim(buildFlatList(null, layers, []));
			expect(result).toEqual([
				{ id: 'A', kind: 'layer', depth: 0, parentGroupId: null },
				{ id: 'B', kind: 'layer', depth: 0, parentGroupId: null }
			]);
		});
	});

	describe('root-level groups only', () => {
		it('returns groups sorted by index ascending', () => {
			const groups = [group('G1', 1), group('G2', 0)];
			const result = slim(buildFlatList(null, [], groups));
			expect(result.map((i) => i.id)).toEqual(['G2', 'G1']);
		});

		it('group items have kind group-header', () => {
			const result = slim(buildFlatList(null, [], [group('G', 0)]));
			expect(result[0].kind).toBe('group-header');
		});

		it('empty groups produce only their header', () => {
			const result = slim(buildFlatList(null, [], [group('G', 0)]));
			expect(result).toHaveLength(1);
		});
	});

	describe('mixed root items', () => {
		it('groups and layers are interleaved by index', () => {
			const layers = [layer('A', 1), layer('B', 3)];
			const groups = [group('G', 0), group('G2', 2)];
			const ids = slim(buildFlatList(null, layers, groups)).map((i) => i.id);
			expect(ids).toEqual(['G', 'A', 'G2', 'B']);
		});

		it('group before layer when indices are equal', () => {
			const layers = [layer('A', 0)];
			const groups = [group('G', 0)];
			const result = slim(buildFlatList(null, layers, groups));
			expect(result.map((i) => i.id)).toEqual(['G', 'A']);
		});
	});

	describe('layers inside a group', () => {
		it('layer in a group has depth 1 and parentGroupId set to group id', () => {
			const groups = [group('G', 0)];
			const layers = [layer('A', 0, 'G')];
			const result = slim(buildFlatList(null, layers, groups));
			expect(result).toEqual([
				{ id: 'G', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'A', kind: 'layer', depth: 1, parentGroupId: 'G' }
			]);
		});

		it('multiple layers inside group are sorted by index', () => {
			const groups = [group('G', 0)];
			const layers = [layer('B', 1, 'G'), layer('A', 0, 'G')];
			const ids = slim(buildFlatList(null, layers, groups)).map((i) => i.id);
			expect(ids).toEqual(['G', 'A', 'B']);
		});

		it('root layers are not included under group', () => {
			const groups = [group('G', 0)];
			const layers = [layer('inGroup', 0, 'G'), layer('root', 1)];
			const result = slim(buildFlatList(null, layers, groups));
			expect(result.map((i) => i.id)).toEqual(['G', 'inGroup', 'root']);
		});
	});

	describe('collapsed groups', () => {
		it('children of a collapsed group are excluded', () => {
			const groups = [group('G', 0, null, true)];
			const layers = [layer('A', 0, 'G')];
			const result = slim(buildFlatList(null, layers, groups));
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('G');
		});

		it('collapsed group still appears itself', () => {
			const groups = [group('G', 0, null, true)];
			const result = slim(buildFlatList(null, [], groups));
			expect(result[0].kind).toBe('group-header');
		});

		it('non-collapsed group shows children; collapsed sibling does not', () => {
			const groups = [group('Open', 0), group('Closed', 1, null, true)];
			const layers = [layer('insideOpen', 0, 'Open'), layer('insideClosed', 0, 'Closed')];
			const ids = slim(buildFlatList(null, layers, groups)).map((i) => i.id);
			expect(ids).toContain('insideOpen');
			expect(ids).not.toContain('insideClosed');
		});

		it('collapsed nested group hides its subtree but parent stays open', () => {
			const groups = [
				group('Parent', 0),
				group('Child', 0, 'Parent', true),
			];
			const layers = [layer('L1', 0, 'Child'), layer('L2', 1, 'Parent')];
			const result = slim(buildFlatList(null, layers, groups));
			const ids = result.map((i) => i.id);
			expect(ids).toContain('Parent');
			expect(ids).toContain('Child');
			expect(ids).toContain('L2');
			expect(ids).not.toContain('L1');
		});
	});

	describe('nested groups', () => {
		it('grandparent > parent > child depths are 0, 1, 2', () => {
			const groups = [group('GP', 0), group('P', 0, 'GP'), group('C', 0, 'P')];
			const result = slim(buildFlatList(null, [], groups));
			expect(result.map((i) => ({ id: i.id, depth: i.depth }))).toEqual([
				{ id: 'GP', depth: 0 },
				{ id: 'P', depth: 1 },
				{ id: 'C', depth: 2 }
			]);
		});

		it('layer inside grandchild group has depth 3', () => {
			const groups = [group('GP', 0), group('P', 0, 'GP'), group('C', 0, 'P')];
			const layers = [layer('L', 0, 'C')];
			const result = slim(buildFlatList(null, layers, groups));
			const layerItem = result.find((i) => i.id === 'L');
			expect(layerItem?.depth).toBe(3);
		});

		it('parentGroupId of nested group is its direct parent id', () => {
			const groups = [group('GP', 0), group('Child', 0, 'GP')];
			const result = slim(buildFlatList(null, [], groups));
			const childItem = result.find((i) => i.id === 'Child');
			expect(childItem?.parentGroupId).toBe('GP');
		});

		it('collapses only the collapsed ancestor, not siblings', () => {
			const groups = [
				group('G1', 0, null, true),
				group('G2', 1)
			];
			const layers = [layer('inG1', 0, 'G1'), layer('inG2', 0, 'G2')];
			const ids = slim(buildFlatList(null, layers, groups)).map((i) => i.id);
			expect(ids).toContain('inG2');
			expect(ids).not.toContain('inG1');
		});
	});

	describe('layers without a groupId are treated as root', () => {
		it('layer with groupId=undefined lands at root', () => {
			const result = slim(buildFlatList(null, [{ id: 'L', index: 0 }], []));
			expect(result[0].parentGroupId).toBeNull();
		});

		it('layer with groupId=null lands at root', () => {
			const result = slim(buildFlatList(null, [layer('L', 0, null)], []));
			expect(result[0].parentGroupId).toBeNull();
		});
	});
});

function flat(
	...items: Array<{ id: string; kind: 'layer' | 'group-header'; depth?: number; parentGroupId?: string | null }>
): FlatItem[] {
	return items.map(({ id, kind, depth = 0, parentGroupId = null }) => ({
		id,
		kind,
		depth,
		parentGroupId
	}));
}

describe('computeDropChanges', () => {
	describe('root-level layer reordering', () => {
		function rootThree() {
			return flat(
				{ id: 'A', kind: 'layer' },
				{ id: 'B', kind: 'layer' },
				{ id: 'C', kind: 'layer' }
			);
		}

		it('move first to last', () => {
			const changes = computeDropChanges(rootThree(), 0, 2, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['A'].newIndex).toBe(2);
			expect(map['B'].newIndex).toBe(0);
			expect(map['C'].newIndex).toBe(1);
		});

		it('move last to first', () => {
			const changes = computeDropChanges(rootThree(), 2, 0, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['C'].newIndex).toBe(0);
			expect(map['A'].newIndex).toBe(1);
			expect(map['B'].newIndex).toBe(2);
		});

		it('move middle to last', () => {
			const changes = computeDropChanges(rootThree(), 1, 2, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['B'].newIndex).toBe(2);
			expect(map['A'].newIndex).toBe(0);
			expect(map['C'].newIndex).toBe(1);
		});

		it('drop in same position is a no-op', () => {
			const changes = computeDropChanges(rootThree(), 1, 1, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['A'].newIndex).toBe(0);
			expect(map['B'].newIndex).toBe(1);
			expect(map['C'].newIndex).toBe(2);
		});

		it('kind is layer for layer items', () => {
			const changes = computeDropChanges(rootThree(), 0, 2, null);
			expect(changes.every((c) => c.kind === 'layer')).toBe(true);
		});
	});

	describe('layer moves from root into a group', () => {
		function withGroup() {
			return flat(
				{ id: 'G', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'B', kind: 'layer', depth: 1, parentGroupId: 'G' },
				{ id: 'A', kind: 'layer', depth: 0, parentGroupId: null }
			);
		}

		it('source gets newParentId set to the group id', () => {
			const changes = computeDropChanges(withGroup(), 2, 1, 'G');
			const aChange = changes.find((c) => c.id === 'A');
			expect(aChange?.newParentId).toBe('G');
		});

		it('group header G is NOT in the change set', () => {
			const changes = computeDropChanges(withGroup(), 2, 1, 'G');
			expect(changes.find((c) => c.id === 'G')).toBeUndefined();
		});

		it('layer A is correctly indexed inside the group', () => {
			const changes = computeDropChanges(withGroup(), 2, 1, 'G');
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['A'].newIndex).toBe(0);
			expect(map['B'].newIndex).toBe(1);
		});
	});

	describe('layer moves from a group to root', () => {
		function layerInGroup() {
			return flat(
				{ id: 'G', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'A', kind: 'layer', depth: 1, parentGroupId: 'G' },
				{ id: 'B', kind: 'layer', depth: 0, parentGroupId: null }
			);
		}

		it('source A gets newParentId null', () => {
			const changes = computeDropChanges(layerInGroup(), 1, 2, null);
			const aChange = changes.find((c) => c.id === 'A');
			expect(aChange?.newParentId).toBeNull();
		});

		it('root scope is reindexed correctly', () => {
			const changes = computeDropChanges(layerInGroup(), 1, 2, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['G'].newIndex).toBe(0);
			expect(map['B'].newIndex).toBe(1);
			expect(map['A'].newIndex).toBe(2);
		});
	});

	describe('layer moves between two groups', () => {
		function twoGroups() {
			return flat(
				{ id: 'G1', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'A', kind: 'layer', depth: 1, parentGroupId: 'G1' },
				{ id: 'G2', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'B', kind: 'layer', depth: 1, parentGroupId: 'G2' }
			);
		}

		it('source A gets newParentId G2', () => {
			const changes = computeDropChanges(twoGroups(), 1, 2, 'G2');
			const aChange = changes.find((c) => c.id === 'A');
			expect(aChange?.newParentId).toBe('G2');
		});

		it('group headers are NOT in change set', () => {
			const changes = computeDropChanges(twoGroups(), 1, 2, 'G2');
			expect(changes.find((c) => c.id === 'G1')).toBeUndefined();
			expect(changes.find((c) => c.id === 'G2')).toBeUndefined();
		});

		it('G2 scope is reindexed correctly', () => {
			const changes = computeDropChanges(twoGroups(), 1, 2, 'G2');
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['A'].newIndex).toBe(0);
			expect(map['B'].newIndex).toBe(1);
		});
	});

	describe('root-level group reordering', () => {
		function threeGroups() {
			return flat(
				{ id: 'G1', kind: 'group-header' },
				{ id: 'G2', kind: 'group-header' },
				{ id: 'G3', kind: 'group-header' }
			);
		}

		it('move G1 to last', () => {
			const changes = computeDropChanges(threeGroups(), 0, 2, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['G1'].newIndex).toBe(2);
			expect(map['G2'].newIndex).toBe(0);
			expect(map['G3'].newIndex).toBe(1);
		});

		it('move G3 to first', () => {
			const changes = computeDropChanges(threeGroups(), 2, 0, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['G3'].newIndex).toBe(0);
			expect(map['G1'].newIndex).toBe(1);
			expect(map['G2'].newIndex).toBe(2);
		});

		it('kind is group for group-header items', () => {
			const changes = computeDropChanges(threeGroups(), 0, 2, null);
			const g1Change = changes.find((c) => c.id === 'G1');
			expect(g1Change?.kind).toBe('group');
		});

		it('same position is a no-op', () => {
			const changes = computeDropChanges(threeGroups(), 1, 1, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['G1'].newIndex).toBe(0);
			expect(map['G2'].newIndex).toBe(1);
			expect(map['G3'].newIndex).toBe(2);
		});
	});

	describe('group nests into another group', () => {
		function twoRootGroups() {
			return flat(
				{ id: 'G1', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'G2', kind: 'group-header', depth: 0, parentGroupId: null }
			);
		}

		it('G2 gets newParentId G1', () => {
			const changes = computeDropChanges(twoRootGroups(), 1, 1, 'G1');
			const g2Change = changes.find((c) => c.id === 'G2');
			expect(g2Change?.newParentId).toBe('G1');
		});

		it('G1 is NOT in the change set', () => {
			const changes = computeDropChanges(twoRootGroups(), 1, 1, 'G1');
			expect(changes.find((c) => c.id === 'G1')).toBeUndefined();
		});

		it('G2 is first child of G1', () => {
			const changes = computeDropChanges(twoRootGroups(), 1, 1, 'G1');
			const g2Change = changes.find((c) => c.id === 'G2');
			expect(g2Change?.newIndex).toBe(0);
		});
	});

	describe('nested group moves to root', () => {
		function nestedGroup() {
			return flat(
				{ id: 'GP', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'Child', kind: 'group-header', depth: 1, parentGroupId: 'GP' },
				{ id: 'L', kind: 'layer', depth: 0, parentGroupId: null }
			);
		}

		it('Child gets newParentId null', () => {
			const changes = computeDropChanges(nestedGroup(), 1, 2, null);
			const childChange = changes.find((c) => c.id === 'Child');
			expect(childChange?.newParentId).toBeNull();
		});

		it('root scope is reindexed correctly', () => {
			const changes = computeDropChanges(nestedGroup(), 1, 2, null);
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['GP'].newIndex).toBe(0);
			expect(map['L'].newIndex).toBe(1);
			expect(map['Child'].newIndex).toBe(2);
		});
	});

	describe('layer reordering inside a group', () => {
		function groupWithThreeLayers() {
			return flat(
				{ id: 'G', kind: 'group-header', depth: 0, parentGroupId: null },
				{ id: 'A', kind: 'layer', depth: 1, parentGroupId: 'G' },
				{ id: 'B', kind: 'layer', depth: 1, parentGroupId: 'G' },
				{ id: 'C', kind: 'layer', depth: 1, parentGroupId: 'G' }
			);
		}

		it('move A to last position inside G', () => {
			const changes = computeDropChanges(groupWithThreeLayers(), 1, 3, 'G');
			const map = Object.fromEntries(changes.map((c) => [c.id, c]));
			expect(map['A'].newIndex).toBe(2);
			expect(map['B'].newIndex).toBe(0);
			expect(map['C'].newIndex).toBe(1);
		});

		it('G header is NOT in change set', () => {
			const changes = computeDropChanges(groupWithThreeLayers(), 1, 3, 'G');
			expect(changes.find((c) => c.id === 'G')).toBeUndefined();
		});

		it('no newParentId when parent stays the same', () => {
			const changes = computeDropChanges(groupWithThreeLayers(), 1, 3, 'G');
			const aChange = changes.find((c) => c.id === 'A');
			expect(aChange?.newParentId).toBeUndefined();
		});
	});

	describe('regression: group index not affected when layer enters it', () => {
		function layerAboveGroup() {
			return flat(
				{ id: 'A', kind: 'layer', depth: 0, parentGroupId: null },
				{ id: 'G', kind: 'group-header', depth: 0, parentGroupId: null }
			);
		}

		it('moving root layer A into G does not include G in changes', () => {
			const changes = computeDropChanges(layerAboveGroup(), 0, 1, 'G');
			expect(changes.find((c) => c.id === 'G')).toBeUndefined();
		});

		it('only A appears with its new group assignment', () => {
			const changes = computeDropChanges(layerAboveGroup(), 0, 1, 'G');
			expect(changes).toHaveLength(1);
			expect(changes[0].id).toBe('A');
			expect(changes[0].newParentId).toBe('G');
			expect(changes[0].newIndex).toBe(0);
		});
	});

	describe('single item', () => {
		it('dropping the only item on itself produces one change', () => {
			const list = flat({ id: 'A', kind: 'layer' });
			const changes = computeDropChanges(list, 0, 0, null);
			expect(changes).toHaveLength(1);
			expect(changes[0].newIndex).toBe(0);
		});
	});

	describe('result shape', () => {
		it('every DropChange has id, kind, and newIndex', () => {
			const list = flat(
				{ id: 'A', kind: 'layer' },
				{ id: 'B', kind: 'layer' }
			);
			const changes = computeDropChanges(list, 0, 1, null);
			for (const c of changes) {
				expect(typeof c.id).toBe('string');
				expect(['layer', 'group']).toContain(c.kind);
				expect(typeof c.newIndex).toBe('number');
			}
		});

		it('newParentId is absent when parent is unchanged', () => {
			const list = flat({ id: 'A', kind: 'layer' }, { id: 'B', kind: 'layer' });
			const changes = computeDropChanges(list, 0, 1, null);
			for (const c of changes) {
				expect('newParentId' in c).toBe(false);
			}
		});

		it('newParentId is present when parent changes', () => {
			const list = flat(
				{ id: 'G', kind: 'group-header', parentGroupId: null },
				{ id: 'A', kind: 'layer', parentGroupId: null }
			);
			const changes = computeDropChanges(list, 1, 1, 'G');
			const aChange = changes.find((c) => c.id === 'A');
			expect('newParentId' in (aChange ?? {})).toBe(true);
		});
	});
});
