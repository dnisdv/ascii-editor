import { beforeEach, describe, expect, it } from 'vitest';
import { LayersManager } from '../layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer/layer.serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { CreateAndActivateLayerCommand } from './create-activate-layer.cmd';
import { updateLayerCommand } from './update-layer.cmd';
import { removeAndActivateLayerCommand } from './remove-activate-layer.cmd';
import { activateLayerCommand } from './activate-layer.cmd';

describe('Layers commands', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		const config = new Config();
		historyManager = new HistoryManager();
		const smartObjectsManager = new SmartObjectsManager(config);
		const layerSerializer = new LayerSerializer(smartObjectsManager, config);
		layersManager = new LayersManager({ config, historyManager, layerSerializer });
	});

	it('CreateAndActivateLayerCommand creates layer, sets active, and supports undo/redo', () => {
		const cmd = new CreateAndActivateLayerCommand(layersManager.internalOps(), historyManager);
		const { id } = cmd.execute();

		expect(layersManager.getLayers().map((l) => l.id)).toContain(id);
		expect(layersManager.getActiveLayerKey()).toBe(id);
		expect(historyManager.getHistory().length).toBe(1);

		historyManager.undo();
		expect(layersManager.getLayer(id)).toBeNull();
		expect(layersManager.getActiveLayerKey()).toBeNull();

		historyManager.redo();
		expect(layersManager.getLayer(id)).not.toBeNull();
		expect(layersManager.getActiveLayerKey()).toBe(id);
	});

	it('updateLayerCommand updates layer and supports undo/redo', () => {
		const [id] = layersManager.addLayer();
		const beforeName = layersManager.getLayer(id)!.name;

		const cmd = new updateLayerCommand(layersManager.internalOps(), historyManager);
		cmd.execute(id, { name: 'Updated' });
		expect(layersManager.getLayer(id)!.name).toBe('Updated');

		historyManager.undo();
		expect(layersManager.getLayer(id)!.name).toBe(beforeName);

		historyManager.redo();
		expect(layersManager.getLayer(id)!.name).toBe('Updated');
	});

	it('removeAndActivateLayerCommand removes layer, activates neighbor, and supports undo/redo', () => {
		const [id1] = layersManager.addLayer();
		const [id2] = layersManager.addLayer();
		expect(layersManager.getActiveLayerKey()).toBe(id2);

		const cmd = new removeAndActivateLayerCommand(layersManager.internalOps(), historyManager);
		cmd.execute(id2);

		expect(layersManager.getLayer(id2)).toBeNull();
		expect(layersManager.getActiveLayerKey()).toBe(id1);

		historyManager.undo();
		expect(layersManager.getLayer(id2)).not.toBeNull();
		expect(layersManager.getActiveLayerKey()).toBe(id2);

		historyManager.redo();
		expect(layersManager.getLayer(id2)).toBeNull();
		expect(layersManager.getActiveLayerKey()).toBe(id1);
	});

	it('activateLayerCommand changes active layer and supports undo/redo', () => {
		const [id1] = layersManager.addLayer();
		const [id2] = layersManager.addLayer();
		expect(layersManager.getActiveLayerKey()).toBe(id2);

		const cmd = new activateLayerCommand(layersManager.internalOps(), historyManager);
		cmd.execute(id1);
		expect(layersManager.getActiveLayerKey()).toBe(id1);

		historyManager.undo();
		expect(layersManager.getActiveLayerKey()).toBe(id2);

		historyManager.redo();
		expect(layersManager.getActiveLayerKey()).toBe(id1);
	});
});
