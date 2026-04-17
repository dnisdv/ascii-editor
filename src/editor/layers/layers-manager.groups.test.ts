import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LayersManager } from './layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer/layer.serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';

function setup() {
	const config = new Config();
	const historyManager = new HistoryManager();
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register(MockSmartObject.type, MockSmartObject);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });
	return { layersManager, historyManager };
}

describe('LayersManager – Group Management', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		({ layersManager, historyManager } = setup());
	});

	afterEach(() => {
		layersManager.clearLayers();
		layersManager['groupManager'].clear();
	});

	describe('createGroup / getGroup / getGroups', () => {
		it('creates a root group with correct defaults', () => {
			const g = layersManager.createGroup('MyGroup');
			expect(g.name).toBe('MyGroup');
			expect(g.parentId).toBeNull();
			expect(g.collapsed).toBe(false);
			expect(layersManager.getGroup(g.id)).toBe(g);
		});

		it('creates nested group with parentId', () => {
			const parent = layersManager.createGroup('parent');
			const child = layersManager.createGroup('child', parent.id);
			expect(child.parentId).toBe(parent.id);
		});

		it('getGroups returns all groups', () => {
			const a = layersManager.createGroup('a');
			const b = layersManager.createGroup('b');
			const ids = layersManager.getGroups().map((g) => g.id);
			expect(ids).toContain(a.id);
			expect(ids).toContain(b.id);
		});

		it('clearGroups empties the group list', () => {
			layersManager.createGroup('x');
			layersManager['groupManager'].clear();
			expect(layersManager.getGroups()).toHaveLength(0);
		});
	});

	describe('setGroupCollapsed (UI state, no history)', () => {
		it('updates collapsed state', () => {
			const g = layersManager.createGroup('g');
			layersManager.setGroupCollapsed(g.id, true);
			expect(layersManager.getGroup(g.id)!.collapsed).toBe(true);
		});

		it('can uncollapse', () => {
			const g = layersManager.createGroup('g');
			layersManager.setGroupCollapsed(g.id, true);
			layersManager.setGroupCollapsed(g.id, false);
			expect(layersManager.getGroup(g.id)!.collapsed).toBe(false);
		});
	});

	describe('updateGroup', () => {
		it('records group update in history and is undoable', () => {
			const g = layersManager.createGroup('before');
			layersManager.updateGroup(g.id, { name: 'after' });
			expect(layersManager.getGroup(g.id)!.name).toBe('after');

			historyManager.undo();
			expect(layersManager.getGroup(g.id)!.name).toBe('before');

			historyManager.redo();
			expect(layersManager.getGroup(g.id)!.name).toBe('after');
		});
	});

	describe('layer assignment', () => {
		it('addLayerToGroup assigns layer to group', () => {
			const g = layersManager.createGroup('g');
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, g.id);
			expect(layersManager.getRealLayer(id)!.groupId).toBe(g.id);
		});

		it('addLayerToGroup is a no-op for unknown group', () => {
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, 'nonexistent');
			expect(layersManager.getRealLayer(id)!.groupId).toBeNull();
		});

		it('removeLayerFromGroup clears groupId', () => {
			const g = layersManager.createGroup('g');
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, g.id);
			layersManager.removeLayerFromGroup(id);
			expect(layersManager.getRealLayer(id)!.groupId).toBeNull();
		});

		it('layers added to a group have the correct groupId', () => {
			const g = layersManager.createGroup('g');
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const [id3] = layersManager.addLayer(); // not in group
			layersManager.addLayerToGroup(id1, g.id);
			layersManager.addLayerToGroup(id2, g.id);

			expect(layersManager.getRealLayer(id1)!.groupId).toBe(g.id);
			expect(layersManager.getRealLayer(id2)!.groupId).toBe(g.id);
			expect(layersManager.getRealLayer(id3)!.groupId).toBeNull();
		});

		it('addLayerInGroup creates a layer already inside the group', () => {
			const g = layersManager.createGroup('g');
			const result = layersManager.addLayerInGroup(g.id);
			expect(result).not.toBeNull();
			const [newId] = result!;
			expect(layersManager.getRealLayer(newId)!.groupId).toBe(g.id);
		});
	});

	describe('groupLayers', () => {
		it('creates a group and moves layers into it', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const group = layersManager.groupLayers([id1, id2], 'Grouped');

			expect(group).not.toBeNull();
			expect(layersManager.getGroup(group!.id)).toBeTruthy();
			expect(layersManager.getRealLayer(id1)!.groupId).toBe(group!.id);
			expect(layersManager.getRealLayer(id2)!.groupId).toBe(group!.id);
		});

		it('returns null for empty id list', () => {
			expect(layersManager.groupLayers([])).toBeNull();
		});

		it('is undoable as a single step (undo removes group and clears layer groupIds)', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const historyLenBefore = historyManager.getHistory().length;

			const group = layersManager.groupLayers([id1, id2], 'G');
			expect(historyManager.getHistory().length).toBeGreaterThan(historyLenBefore);

			historyManager.undo();

			expect(layersManager.getGroup(group!.id)).toBeUndefined();
			expect(layersManager.getRealLayer(id1)!.groupId).toBeNull();
			expect(layersManager.getRealLayer(id2)!.groupId).toBeNull();
		});

		it('is redoable after undo', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const group = layersManager.groupLayers([id1, id2], 'G');

			historyManager.undo();
			historyManager.redo();

			expect(layersManager.getGroup(group!.id)).toBeTruthy();
			expect(layersManager.getRealLayer(id1)!.groupId).toBe(group!.id);
			expect(layersManager.getRealLayer(id2)!.groupId).toBe(group!.id);
		});
	});

	describe('removeGroup', () => {
		it('dissolves group and moves layers to root', () => {
			const g = layersManager.createGroup('g');
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			layersManager.addLayerToGroup(id1, g.id);
			layersManager.addLayerToGroup(id2, g.id);

			layersManager.removeGroup(g.id);

			expect(layersManager.getGroup(g.id)).toBeUndefined();
			expect(layersManager.getRealLayer(id1)!.groupId).toBeNull();
			expect(layersManager.getRealLayer(id2)!.groupId).toBeNull();
		});

		it('with removeChildren=true removes all descendant groups', () => {
			const parent = layersManager.createGroup('parent');
			const child = layersManager.createGroup('child', parent.id);
			const grandchild = layersManager.createGroup('grandchild', child.id);

			layersManager.removeGroup(parent.id, true);

			expect(layersManager.getGroup(parent.id)).toBeUndefined();
			expect(layersManager.getGroup(child.id)).toBeUndefined();
			expect(layersManager.getGroup(grandchild.id)).toBeUndefined();
		});

		it('without removeChildren re-parents child groups to grandparent', () => {
			const grandparent = layersManager.createGroup('gp');
			const parent = layersManager.createGroup('parent', grandparent.id);
			const child = layersManager.createGroup('child', parent.id);

			layersManager.removeGroup(parent.id, false);

			expect(layersManager.getGroup(parent.id)).toBeUndefined();
			expect(layersManager.getGroup(child.id)!.parentId).toBe(grandparent.id);
		});

		it('is undoable (group and layer assignments are restored)', () => {
			const g = layersManager.createGroup('g');
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, g.id);

			layersManager.removeGroup(g.id);
			expect(layersManager.getGroup(g.id)).toBeUndefined();

			historyManager.undo();

			expect(layersManager.getGroup(g.id)).toBeTruthy();
			expect(layersManager.getRealLayer(id)!.groupId).toBe(g.id);
		});
	});


	describe('toggleGroupVisibility', () => {
		it('hides the group and all its layers', () => {
			const g = layersManager.createGroup('g');
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			layersManager.addLayerToGroup(id1, g.id);
			layersManager.addLayerToGroup(id2, g.id);

			layersManager.toggleGroupVisibility(g.id);

			expect(layersManager.getGroup(g.id)!.opts.visible).toBe(false);
			expect(layersManager.getRealLayer(id1)!.getOpts().visible).toBe(false);
			expect(layersManager.getRealLayer(id2)!.getOpts().visible).toBe(false);
		});

		it('toggles back to visible', () => {
			const g = layersManager.createGroup('g');
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, g.id);

			layersManager.toggleGroupVisibility(g.id); // hide
			layersManager.toggleGroupVisibility(g.id); // show

			expect(layersManager.getGroup(g.id)!.opts.visible).toBe(true);
			expect(layersManager.getRealLayer(id)!.getOpts().visible).toBe(true);
		});

		it('cascades visibility to nested child groups and their layers', () => {
			const parent = layersManager.createGroup('parent');
			const child = layersManager.createGroup('child', parent.id);
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, child.id);

			layersManager.toggleGroupVisibility(parent.id);

			expect(layersManager.getGroup(parent.id)!.opts.visible).toBe(false);
			expect(layersManager.getGroup(child.id)!.opts.visible).toBe(false);
			expect(layersManager.getRealLayer(id)!.getOpts().visible).toBe(false);
		});

		it('is fully undoable as a single step', () => {
			const g = layersManager.createGroup('g');
			const [id] = layersManager.addLayer();
			layersManager.addLayerToGroup(id, g.id);

			layersManager.toggleGroupVisibility(g.id);
			expect(layersManager.getGroup(g.id)!.opts.visible).toBe(false);
			expect(layersManager.getRealLayer(id)!.getOpts().visible).toBe(false);

			historyManager.undo();

			expect(layersManager.getGroup(g.id)!.opts.visible).toBe(true);
			expect(layersManager.getRealLayer(id)!.getOpts().visible).toBe(true);
		});
	});

	describe('group events', () => {
		it('emits group::added when a group is created', () => {
			const spy = vi.fn();
			layersManager.on('group::added', spy);
			layersManager.createGroup('ev');
			expect(spy).toHaveBeenCalledOnce();
		});

		it('emits group::removed when a group is removed', () => {
			const g = layersManager.createGroup('ev');
			const spy = vi.fn();
			layersManager.on('group::removed', spy);
			layersManager.removeGroup(g.id);
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: g.id }));
		});

		it('emits group::updated when a group is updated', () => {
			const g = layersManager.createGroup('ev');
			const spy = vi.fn();
			layersManager.on('group::updated', spy);
			layersManager.updateGroup(g.id, { name: 'changed' });
			expect(spy).toHaveBeenCalledOnce();
		});
	});
});
