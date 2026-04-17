import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerGroupManager } from './layer-group-manager';
import { ScopeIndexAllocator } from './scope-index-allocator';

describe('LayerGroupManager', () => {
	let gm: LayerGroupManager;

	beforeEach(() => {
		gm = new LayerGroupManager(ScopeIndexAllocator.forGroups(() => gm.getGroups()));
	});

	function makeGroup(name: string, parentId: string | null = null) {
		const g = gm.createGroupObject(name, parentId);
		gm.addGroup(g);
		return g;
	}

	describe('createGroupObject + addGroup', () => {
		it('creates a group with correct defaults', () => {
			const g = makeGroup('A');
			expect(g.name).toBe('A');
			expect(g.parentId).toBeNull();
			expect(g.collapsed).toBe(false);
			expect(g.opts.visible).toBe(true);
			expect(g.opts.locked).toBe(false);
		});

		it('auto-assigns index based on sibling count', () => {
			const g0 = makeGroup('first');
			const g1 = makeGroup('second');
			expect(g0.index).toBe(0);
			expect(g1.index).toBe(1);
		});

		it('indexes child groups independently from root groups', () => {
			const parent = makeGroup('parent');
			const child0 = makeGroup('c0', parent.id);
			const child1 = makeGroup('c1', parent.id);
			const root1 = makeGroup('root1');
			expect(child0.index).toBe(0);
			expect(child1.index).toBe(1);
			expect(root1.index).toBe(1);
		});

		it('stores the group so getGroup returns it', () => {
			const g = makeGroup('X');
			expect(gm.getGroup(g.id)).toBe(g);
		});
	});

	describe('addGroup / removeGroup', () => {
		it('addGroup makes group retrievable', () => {
			const g = gm.createGroupObject('manual');
			gm.addGroup(g);

			expect(gm.hasGroup(g.id)).toBe(true);
			expect(gm.getGroup(g.id)).toBe(g);
		});

		it('removeGroup deletes the group', () => {
			const g = makeGroup('tmp');
			gm.removeGroup(g.id);

			expect(gm.hasGroup(g.id)).toBe(false);
			expect(gm.getGroup(g.id)).toBeUndefined();
		});

		it('removeGroup is a no-op for unknown id', () => {
			expect(() => gm.removeGroup('nonexistent')).not.toThrow();
		});
	});

	describe('updateGroup', () => {
		it('updates name', () => {
			const g = makeGroup('old');
			gm.updateGroup(g.id, { name: 'new' });
			expect(gm.getGroup(g.id)!.name).toBe('new');
		});

		it('updates collapsed', () => {
			const g = makeGroup('g');
			gm.updateGroup(g.id, { collapsed: true });
			expect(gm.getGroup(g.id)!.collapsed).toBe(true);
		});

		it('updates parentId', () => {
			const parent = makeGroup('parent');
			const child = makeGroup('child');

			gm.updateGroup(child.id, { parentId: parent.id });

			expect(gm.getGroup(child.id)!.parentId).toBe(parent.id);
		});

		it('updates opts partially', () => {
			const g = makeGroup('g');
			gm.updateGroup(g.id, { opts: { visible: false } });

			expect(gm.getGroup(g.id)!.opts.visible).toBe(false);
			expect(gm.getGroup(g.id)!.opts.locked).toBe(false); // untouched
		});

		it('is a no-op for unknown id', () => {
			expect(() => gm.updateGroup('nope', { name: 'x' })).not.toThrow();
		});
	});


	describe('getGroupsInParent', () => {
		it('returns root groups sorted by index', () => {
			const a = makeGroup('a');
			const b = makeGroup('b');
			gm.updateGroup(a.id, { index: 1 });
			gm.updateGroup(b.id, { index: 0 });
			const result = gm.getGroupsInParent(null);
			expect(result.map((g) => g.id)).toEqual([b.id, a.id]);
		});

		it('returns children of a specific group', () => {
			const parent = makeGroup('parent');
			const c1 = makeGroup('c1', parent.id);
			const c2 = makeGroup('c2', parent.id);
			makeGroup('other'); 

			const children = gm.getGroupsInParent(parent.id);
			expect(children.map((g) => g.id)).toEqual([c1.id, c2.id]);
		});

		it('returns empty array when no children', () => {
			const g = makeGroup('solo');
			expect(gm.getGroupsInParent(g.id)).toHaveLength(0);
		});
	});

	describe('getChildGroupIds', () => {
		it('returns all descendant ids (depth-first)', () => {
			const root = makeGroup('root');
			const a = makeGroup('a', root.id);
			const b = makeGroup('b', root.id);
			const a1 = makeGroup('a1', a.id);

			const ids = gm.getChildGroupIds(root.id);
			expect(ids).toContain(a.id);
			expect(ids).toContain(b.id);
			expect(ids).toContain(a1.id);
			expect(ids).not.toContain(root.id);
		});

		it('returns empty for a leaf group', () => {
			const leaf = makeGroup('leaf');
			expect(gm.getChildGroupIds(leaf.id)).toHaveLength(0);
		});
	});

	describe('events', () => {
		it('emits group::added on addGroup', () => {
			const spy = vi.fn();
			gm.on('group::added', spy);
			const g = makeGroup('ev');
			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith({ group: g });
		});

		it('emits group::removed on removeGroup', () => {
			const g = makeGroup('ev');
			const spy = vi.fn();
			gm.on('group::removed', spy);
			gm.removeGroup(g.id);
			expect(spy).toHaveBeenCalledWith({ id: g.id });
		});

		it('emits group::updated on updateGroup', () => {
			const g = makeGroup('ev');
			const spy = vi.fn();
			gm.on('group::updated', spy);
			gm.updateGroup(g.id, { name: 'renamed' });
			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: g.id, name: 'renamed' }));
		});

		it('does not emit group::removed for unknown id', () => {
			const spy = vi.fn();
			gm.on('group::removed', spy);
			gm.removeGroup('ghost');
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('clear', () => {
		it('removes all groups', () => {
			makeGroup('a');
			makeGroup('b');
			gm.clear();
			expect(gm.getGroups()).toHaveLength(0);
		});
	});
});
