import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LayersSerializer } from './layers.serializer';
import { LayerSerializer } from './layer.serializer';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';

function setup() {
	const config = new Config();
	const historyManager = new HistoryManager();
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register(MockSmartObject.type, MockSmartObject);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });
	const serializer = new LayersSerializer(layerSerializer, layersManager);
	return { layersManager, historyManager, serializer, layerSerializer, config, smartObjectsManager };
}

describe('LayersSerializer – group round-trip', () => {
	let layersManager: LayersManager;
	let serializer: LayersSerializer;
	let layerSerializer: LayerSerializer;
	let config: Config;

	beforeEach(() => {
		({ layersManager, serializer, layerSerializer, config } = setup());
	});

	afterEach(() => {
		layersManager.clearLayers();
		layersManager['groupManager'].clear();
	});

	it('round-trips layers with groups', () => {
		const group = layersManager.createGroup('Group A');
		const [id1] = layersManager.addLayer();
		const [id2] = layersManager.addLayer();
		layersManager.addLayerToGroup(id1, group.id);

		const data = serializer.serialize();

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getGroups()).toHaveLength(1);
		expect(layersManager2.getGroups()[0].name).toBe('Group A');
		expect(layersManager2.getRealLayer(id1)!.groupId).toBe(group.id);
		expect(layersManager2.getRealLayer(id2)!.groupId).toBeNull();
	});

	it('round-trips nested groups', () => {
		const parent = layersManager.createGroup('Parent');
		const child = layersManager.createGroup('Child', parent.id);
		const [lid] = layersManager.addLayer();
		layersManager.addLayerToGroup(lid, child.id);

		const data = serializer.serialize();

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		const groups = layersManager2.getGroups();
		expect(groups).toHaveLength(2);

		const restoredChild = layersManager2.getGroup(child.id);
		expect(restoredChild).toBeDefined();
		expect(restoredChild!.parentId).toBe(parent.id);
		expect(layersManager2.getRealLayer(lid)!.groupId).toBe(child.id);
	});

	it('strips invalid groupId from layers during deserialization', () => {
		const [id1] = layersManager.addLayer();
		const data = serializer.serialize();

		data.data[id1].groupId = 'nonexistent-group';

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getRealLayer(id1)!.groupId).toBeNull();
	});

	it('strips invalid parentId from groups during deserialization', () => {
		const group = layersManager.createGroup('orphan');
		const data = serializer.serialize();

		data.groups![group.id].parentId = 'nonexistent-parent';

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getGroup(group.id)!.parentId).toBeNull();
	});

	it('preserves group collapsed state', () => {
		const group = layersManager.createGroup('G');
		layersManager.setGroupCollapsed(group.id, true);

		const data = serializer.serialize();

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getGroup(group.id)!.collapsed).toBe(true);
	});

	it('preserves group visibility opts', () => {
		const group = layersManager.createGroup('G');
		layersManager['groupManager'].updateGroup(group.id, { opts: { visible: false } });

		const data = serializer.serialize();

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getGroup(group.id)!.opts.visible).toBe(false);
	});

	it('normalizes indices after deserialization', () => {
		const [id1] = layersManager.addLayer();
		const [id2] = layersManager.addLayer();
		const data = serializer.serialize();

		data.data[id1].index = 5;
		data.data[id2].index = 10;

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		const layers = layersManager2.getLayers();
		const indices = layers.map((l) => l.index).sort((a, b) => a - b);
		expect(indices).toEqual([0, 1]);
	});

	it('deserializes with empty groups object', () => {
		layersManager.addLayer();
		const data = serializer.serialize();
		data.groups = {};

		const historyManager2 = new HistoryManager();
		const layersManager2 = new LayersManager({ config, historyManager: historyManager2, layerSerializer });
		const serializer2 = new LayersSerializer(layerSerializer, layersManager2);
		serializer2.deserialize(data);

		expect(layersManager2.getGroups()).toHaveLength(0);
		expect(layersManager2.getLayers()).toHaveLength(1);
	});
});
