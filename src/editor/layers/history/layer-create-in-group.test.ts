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

describe('LayerCreateInGroup history action', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		({ layersManager, historyManager } = setup());
	});

	afterEach(() => {
		layersManager.clearLayers();
		layersManager['groupManager'].clear();
	});

	it('creates a layer inside the specified group', () => {
		const group = layersManager.createGroup('G');
		const result = layersManager.addLayerInGroup(group.id);

		expect(result).not.toBeNull();
		const [id] = result!;
		expect(layersManager.getRealLayer(id)!.groupId).toBe(group.id);
	});

	it('sets the new layer as active', () => {
		const group = layersManager.createGroup('G');
		const [id] = layersManager.addLayerInGroup(group.id)!;

		expect(layersManager.getActiveLayerKey()).toBe(id);
	});

	it('returns null for nonexistent group', () => {
		expect(layersManager.addLayerInGroup('nonexistent')).toBeNull();
	});

	it('is undoable – removes the layer and restores previous active layer', () => {
		const group = layersManager.createGroup('G');
		const [existingId] = layersManager.addLayer();
		layersManager.setActiveLayer(existingId);

		const [newId] = layersManager.addLayerInGroup(group.id)!;
		expect(layersManager.getActiveLayerKey()).toBe(newId);

		historyManager.undo();

		expect(layersManager.getRealLayer(newId)).toBeNull();
		expect(layersManager.getActiveLayerKey()).toBe(existingId);
	});

	it('is redoable – re-creates the layer in the group', () => {
		const group = layersManager.createGroup('G');
		layersManager.addLayer();

		const [newId] = layersManager.addLayerInGroup(group.id)!;

		historyManager.undo();
		historyManager.redo();

		expect(layersManager.getRealLayer(newId)).not.toBeNull();
		expect(layersManager.getRealLayer(newId)!.groupId).toBe(group.id);
		expect(layersManager.getActiveLayerKey()).toBe(newId);
	});

	it('new layer appears in getLayers()', () => {
		const group = layersManager.createGroup('G');
		const countBefore = layersManager.getLayers().length;

		layersManager.addLayerInGroup(group.id);

		expect(layersManager.getLayers().length).toBe(countBefore + 1);
	});
});
