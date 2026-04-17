import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LayersManager } from '../layers-manager';
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

describe('MoveLayers history action', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		({ layersManager, historyManager } = setup());
	});

	afterEach(() => {
		layersManager.clearLayers();
		layersManager['groupManager'].clear();
	});

	it('reorders layers by updating indices', () => {
		const [idA] = layersManager.addLayer();
		const [idB] = layersManager.addLayer();
		const [idC] = layersManager.addLayer();

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newIndex: 2 },
			{ id: idB, kind: 'layer', newIndex: 0 },
			{ id: idC, kind: 'layer', newIndex: 1 }
		]);

		expect(layersManager.getRealLayer(idA)!.index).toBe(2);
		expect(layersManager.getRealLayer(idB)!.index).toBe(0);
		expect(layersManager.getRealLayer(idC)!.index).toBe(1);
	});

	it('moves a layer into a group', () => {
		const group = layersManager.createGroup('G');
		const [idA] = layersManager.addLayer();

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newParentId: group.id, newIndex: 0 }
		]);

		expect(layersManager.getRealLayer(idA)!.groupId).toBe(group.id);
	});

	it('moves a layer out of a group', () => {
		const group = layersManager.createGroup('G');
		const [idA] = layersManager.addLayer();
		layersManager.addLayerToGroup(idA, group.id);

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newParentId: null, newIndex: 0 }
		]);

		expect(layersManager.getRealLayer(idA)!.groupId).toBeNull();
	});

	it('moves a group by updating its index', () => {
		const g1 = layersManager.createGroup('G1');
		const g2 = layersManager.createGroup('G2');

		layersManager.moveLayers([
			{ id: g1.id, kind: 'group', newIndex: 1 },
			{ id: g2.id, kind: 'group', newIndex: 0 }
		]);

		expect(layersManager.getGroup(g1.id)!.index).toBe(1);
		expect(layersManager.getGroup(g2.id)!.index).toBe(0);
	});

	it('nests a group inside another group', () => {
		const g1 = layersManager.createGroup('G1');
		const g2 = layersManager.createGroup('G2');

		layersManager.moveLayers([
			{ id: g2.id, kind: 'group', newParentId: g1.id, newIndex: 0 }
		]);

		expect(layersManager.getGroup(g2.id)!.parentId).toBe(g1.id);
	});

	it('is a no-op for empty items', () => {
		const [idA] = layersManager.addLayer();
		const indexBefore = layersManager.getRealLayer(idA)!.index;
		const historyLenBefore = historyManager.getHistory().length;

		layersManager.moveLayers([]);

		expect(layersManager.getRealLayer(idA)!.index).toBe(indexBefore);
		expect(historyManager.getHistory().length).toBe(historyLenBefore);
	});

	it('is undoable – restores original indices and groupIds', () => {
		const group = layersManager.createGroup('G');
		const [idA] = layersManager.addLayer();
		const [idB] = layersManager.addLayer();

		const origIndexA = layersManager.getRealLayer(idA)!.index;
		const origIndexB = layersManager.getRealLayer(idB)!.index;

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newParentId: group.id, newIndex: 0 },
			{ id: idB, kind: 'layer', newIndex: 0 }
		]);

		historyManager.undo();

		expect(layersManager.getRealLayer(idA)!.groupId).toBeNull();
		expect(layersManager.getRealLayer(idA)!.index).toBe(origIndexA);
		expect(layersManager.getRealLayer(idB)!.index).toBe(origIndexB);
	});

	it('is redoable – reapplies the move', () => {
		const group = layersManager.createGroup('G');
		const [idA] = layersManager.addLayer();

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newParentId: group.id, newIndex: 0 }
		]);

		historyManager.undo();
		historyManager.redo();

		expect(layersManager.getRealLayer(idA)!.groupId).toBe(group.id);
		expect(layersManager.getRealLayer(idA)!.index).toBe(0);
	});

	it('handles mixed layer and group moves', () => {
		const g1 = layersManager.createGroup('G1');
		const [idA] = layersManager.addLayer();

		layersManager.moveLayers([
			{ id: idA, kind: 'layer', newParentId: g1.id, newIndex: 0 },
			{ id: g1.id, kind: 'group', newIndex: 5 }
		]);

		expect(layersManager.getRealLayer(idA)!.groupId).toBe(g1.id);
		expect(layersManager.getGroup(g1.id)!.index).toBe(5);
	});

	it('skips unknown layer ids without throwing', () => {
		const [idA] = layersManager.addLayer();

		expect(() => {
			layersManager.moveLayers([
				{ id: 'nonexistent', kind: 'layer', newIndex: 0 },
				{ id: idA, kind: 'layer', newIndex: 1 }
			]);
		}).not.toThrow();

		expect(layersManager.getRealLayer(idA)!.index).toBe(1);
	});
});
