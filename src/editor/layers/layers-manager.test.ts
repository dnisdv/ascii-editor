import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LayersManager } from './layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer/layer.serializer';

describe('LayersManager', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;
	let layersBus: BaseBusLayers;
	let config: Config;
	let layerSerializer: LayerSerializer;

	beforeEach(() => {
		layersBus = new BaseBusLayers();
		config = new Config();
		historyManager = new HistoryManager();
		layersManager = new LayersManager({ layersBus, config, historyManager });
		layerSerializer = new LayerSerializer({ layersBus });
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State and Basic Properties', () => {
		it('should initialize with an empty layer list and no active layer', () => {
			expect(layersManager.getLayers()).toEqual([]);
			expect(layersManager.getActiveLayerKey()).toBeNull();
			expect(layersManager.getActiveLayer()).toBeNull();
		});
	});

	describe('Core Layer Management Behaviors', () => {
		it('should add new layers, make the latest one active, and assign correct indices', () => {
			const [id1, layer1] = layersManager.addLayer();
			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getLayer(id1)).toBe(layer1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);
			expect(layer1.index).toBe(0);

			const [id2, layer2] = layersManager.addLayer();
			expect(layersManager.getLayers().length).toBe(2);
			expect(layersManager.getLayer(id2)).toBe(layer2);
			expect(layersManager.getActiveLayerKey()).toBe(id2);
			expect(layer1.index).toBe(0);
			expect(layer2.index).toBe(1);
		});

		describe('Layer Removal Scenarios and Active Layer Adjustments', () => {
			let id1: string, id2: string, id3: string, id4: string;

			beforeEach(() => {
				[id1] = layersManager.addLayer();
				[id2] = layersManager.addLayer();
				[id3] = layersManager.addLayer();
				[id4] = layersManager.addLayer();
				layersManager.setActiveLayer(id2);
			});

			it('should activate the next layer when an active middle layer is removed', () => {
				layersManager.removeLayer(id2);
				expect(layersManager.getLayers().map((l) => l.id)).toEqual([id1, id3, id4]);
				expect(layersManager.getLayer(id2)).toBeNull();
				expect(layersManager.getActiveLayerKey()).toBe(id3);
			});

			it('should keep the current active layer if a non-active first layer is removed', () => {
				layersManager.removeLayer(id1);
				expect(layersManager.getLayers().map((l) => l.id)).toEqual([id2, id3, id4]);
				expect(layersManager.getLayer(id1)).toBeNull();
				expect(layersManager.getActiveLayerKey()).toBe(id2);
			});

			it('should activate the next layer when an active first layer is removed', () => {
				layersManager.setActiveLayer(id1);
				layersManager.removeLayer(id1);
				expect(layersManager.getLayers().map((l) => l.id)).toEqual([id2, id3, id4]);
				expect(layersManager.getActiveLayerKey()).toBe(id2);
			});

			it('should keep the current active layer if a non-active last layer is removed', () => {
				layersManager.removeLayer(id4);
				expect(layersManager.getLayers().map((l) => l.id)).toEqual([id1, id2, id3]);
				expect(layersManager.getLayer(id4)).toBeNull();
				expect(layersManager.getActiveLayerKey()).toBe(id2);
			});

			it('should activate the new last layer when an active last layer is removed', () => {
				layersManager.setActiveLayer(id4);
				layersManager.removeLayer(id4);
				expect(layersManager.getLayers().map((l) => l.id)).toEqual([id1, id2, id3]);
				expect(layersManager.getActiveLayerKey()).toBe(id3);
			});

			it('should have no active layer after removing the only existing layer', () => {
				layersManager.clearLayers();
				const [soleId] = layersManager.addLayer();
				layersManager.removeLayer(soleId);
				expect(layersManager.getLayers().length).toBe(0);
				expect(layersManager.getActiveLayerKey()).toBeNull();
			});

			it('should not change layer list or active layer if attempting to remove a non-existent layer', () => {
				const initialLayers = layersManager.getLayers().map((l) => l.id);
				const initialActiveKey = layersManager.getActiveLayerKey();
				layersManager.removeLayer('non-existent-id');
				expect(layersManager.getLayers().map((l) => l.id)).toEqual(initialLayers);
				expect(layersManager.getActiveLayerKey()).toBe(initialActiveKey);
			});
		});

		describe('Setting the Active Layer', () => {
			it('should change the active layer to the specified layer ID', () => {
				const [id1] = layersManager.addLayer();
				layersManager.addLayer();

				layersManager.setActiveLayer(id1);
				expect(layersManager.getActiveLayerKey()).toBe(id1);
			});

			it('should not change active layer if the specified layer is already active', () => {
				const [id1] = layersManager.addLayer();
				layersManager.setActiveLayer(id1);
				expect(layersManager.getActiveLayerKey()).toBe(id1);
			});

			it('should not change active layer if attempting to activate a non-existent layer', () => {
				const [id1] = layersManager.addLayer();
				layersManager.setActiveLayer('non-existent-id');
				expect(layersManager.getActiveLayerKey()).toBe(id1);
			});
		});

		describe('Updating Layer Properties', () => {
			it('should update the name of a specified layer', () => {
				const [id1] = layersManager.addLayer();
				const newName = 'Updated Layer Name';
				layersManager.updateLayer(id1, { name: newName });
				expect(layersManager.getLayer(id1)?.name).toBe(newName);
			});

			it('should update the visibility option of a specified layer', () => {
				const [id1] = layersManager.addLayer();
				expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(true);
				layersManager.updateLayer(id1, { opts: { visible: false } });
				expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(false);
			});

			it('should update the locked option of a specified layer', () => {
				const [id1] = layersManager.addLayer();
				expect(layersManager.getLayer(id1)?.getOpts().locked).toBe(false);
				layersManager.updateLayer(id1, { opts: { locked: true } });
				expect(layersManager.getLayer(id1)?.getOpts().locked).toBe(true);
			});

			it('should update the index of a layer and correctly reorder the layer list', () => {
				const [id1] = layersManager.addLayer();
				const [id2] = layersManager.addLayer();
				const [id3] = layersManager.addLayer();

				layersManager.updateLayer(id1, { index: 2 });
				const layers = layersManager.getLayers();
				expect(layers.map((l) => l.id)).toEqual([id2, id3, id1]);
				expect(layersManager.getLayer(id1)?.index).toBe(2);
				expect(layersManager.getLayer(id2)?.index).toBe(0);
				expect(layersManager.getLayer(id3)?.index).toBe(1);
			});

			it('should not modify any layer if attempting to update a non-existent layer', () => {
				const [id1] = layersManager.addLayer();
				const originalName = layersManager.getLayer(id1)?.name;
				layersManager.updateLayer('non-existent-id', { name: 'Should Not Apply' });
				expect(layersManager.getLayer(id1)?.name).toBe(originalName);
				expect(layersManager.getLayers().length).toBe(1);
			});

			it('should not modify a layer if an empty update object is provided', () => {
				const [id1] = layersManager.addLayer();
				const originalLayerState = layerSerializer.serialize(layersManager.getLayer(id1)!);
				layersManager.updateLayer(id1, {});
				const newLayerState = layerSerializer.serialize(layersManager.getLayer(id1)!);
				expect(newLayerState).toEqual(originalLayerState);
			});
		});
	});

	describe('Bus Event Emission for Core Layer Operations', () => {
		it('should emit creation and active change events when a layer is added', () => {
			const busSpy = vi.spyOn(layersBus, 'emit');
			const [layerId, layerInstance] = layersManager.addLayer();

			expect(busSpy).toHaveBeenCalledWith(
				'layer::create::response',
				expect.objectContaining({ id: layerId, name: layerInstance.name, index: 0 })
			);
			expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: layerId });
		});

		describe('Bus Events During Layer Removal', () => {
			let id1: string, id2: string, id3: string;
			beforeEach(() => {
				[id1] = layersManager.addLayer();
				[id2] = layersManager.addLayer();
				[id3] = layersManager.addLayer();
			});

			it('should emit removal and new active layer (next) events when an active middle layer is removed', () => {
				layersManager.setActiveLayer(id2);
				const busSpy = vi.spyOn(layersBus, 'emit');
				layersManager.removeLayer(id2);
				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: id2 });
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: id3 });
			});

			it('should emit removal and new active layer (next) events when an active first layer is removed', () => {
				layersManager.setActiveLayer(id1);
				const busSpy = vi.spyOn(layersBus, 'emit');
				layersManager.removeLayer(id1);
				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: id1 });
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: id2 });
			});

			it('should emit removal and new active layer (previous) events when an active last layer is removed', () => {
				const busSpy = vi.spyOn(layersBus, 'emit');
				layersManager.removeLayer(id3);
				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: id3 });
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: id2 });
			});

			it('should emit removal event but not active change if the removed layer was not active', () => {
				const busSpy = vi.spyOn(layersBus, 'emit');
				layersManager.removeLayer(id1);
				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: id1 });
				expect(busSpy).not.toHaveBeenCalledWith(
					'layer::change_active::response',
					{ id: id1 },
					expect.anything()
				);
			});

			it('should emit removal and null active layer events when the only layer is removed', () => {
				layersManager.clearLayers();
				const [id] = layersManager.addLayer();
				const busSpy = vi.spyOn(layersBus, 'emit');

				layersManager.removeLayer(id);

				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id });
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: null });
			});
		});

		it('should emit active change event when setting an active layer', () => {
			layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const busSpy = vi.spyOn(layersBus, 'emit');

			layersManager.setActiveLayer(id2);
			expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: id2 });
		});

		it('should emit update event when a layer is updated', () => {
			const [id1] = layersManager.addLayer();
			const busSpy = vi.spyOn(layersBus, 'emit');
			const newName = 'Updated Name';

			layersManager.updateLayer(id1, { name: newName });
			expect(busSpy).toHaveBeenCalledWith(
				'layer::update::response',
				expect.objectContaining({ id: id1, name: newName })
			);
		});
	});

	describe('Internal Event Emission for Core Layer Operations', () => {
		it('should emit an internal active change event when the active layer is changed', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			const managerEventSpy = vi.spyOn(layersManager, 'emit');

			layersManager.setActiveLayer(id1);
			expect(managerEventSpy).toHaveBeenCalledWith('layers::active::change', {
				oldId: id2,
				newId: id1
			});
		});

		it('should emit an internal active change event even if re-activating the same layer', () => {
			const [id1] = layersManager.addLayer();

			const managerEventSpy = vi.spyOn(layersManager, 'emit');
			layersManager.setActiveLayer(id1);
			expect(managerEventSpy).toHaveBeenCalledWith('layers::active::change', {
				oldId: id1,
				newId: id1
			});
		});

		it('should emit an internal update event when a layer is updated', () => {
			const [id1, layer1] = layersManager.addLayer();
			const serializedBefore = layerSerializer.serialize(layer1);

			const managerEventSpy = vi.spyOn(layersManager, 'emit');
			const newName = 'Updated Name';

			layersManager.updateLayer(id1, { name: newName });

			const serializedAfter = layerSerializer.serialize(layersManager.getLayer(id1)!);
			expect(managerEventSpy).toHaveBeenCalledWith('layer::updated', {
				before: serializedBefore,
				after: serializedAfter
			});
			expect(managerEventSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('Operations Bypassing History Recording', () => {
		it('should add a layer and emit events without recording a history action', () => {
			const busSpy = vi.spyOn(layersBus, 'emit');
			const historySpy = vi.spyOn(historyManager, 'applyAction');
			const [layerId] = layersManager.addLayerSilent();

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(layerId);
			expect(busSpy).toHaveBeenNthCalledWith(
				1,
				'layer::create::response',
				expect.objectContaining({ id: layerId })
			);
			expect(busSpy).toHaveBeenNthCalledWith(2, 'layer::change_active::response', { id: layerId });
			expect(historySpy).not.toHaveBeenCalled();
		});

		it('should remove a layer and emit events without recording a history action', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayerSilent();
			const busSpy = vi.spyOn(layersBus, 'emit');
			const historySpy = vi.spyOn(historyManager, 'applyAction');

			layersManager.removeLayerSilent(id2);
			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);
			expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: id2 });
			expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: id1 });
			expect(historySpy).not.toHaveBeenCalled();
		});

		it('should update a layer and emit events without recording a history action', () => {
			const [id1] = layersManager.addLayer();
			const newName = 'Silent Update';
			const busSpy = vi.spyOn(layersBus, 'emit');
			const historySpy = vi.spyOn(historyManager, 'applyAction');

			const updateData = { name: newName, opts: { visible: false } };
			layersManager.updateLayerSilent(id1, updateData);
			const updatedLayer = layersManager.getLayer(id1)!;

			expect(updatedLayer.name).toBe(newName);
			expect(updatedLayer.getOpts().visible).toBe(false);
			expect(busSpy).toHaveBeenCalledWith(
				'layer::update::response',
				expect.objectContaining({ id: id1, name: newName })
			);
			expect(historySpy).not.toHaveBeenCalled();
		});
	});

	describe('Undo/Redo Behavior for Direct Method Calls', () => {
		it('should correctly undo and redo active layer changes', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			layersManager.setActiveLayer(id1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.undo();
			expect(layersManager.getActiveLayerKey()).toBe(id2);

			historyManager.redo();
			expect(layersManager.getActiveLayerKey()).toBe(id1);
		});

		it('should correctly undo and redo layer property updates', () => {
			const [id1, layer1] = layersManager.addLayer();
			const originalName = layer1.name;
			const newName = 'History Update';

			layersManager.updateLayer(id1, { name: newName });
			expect(layersManager.getLayer(id1)?.name).toBe(newName);

			historyManager.undo();
			expect(layersManager.getLayer(id1)?.name).toBe(originalName);

			historyManager.redo();
			expect(layersManager.getLayer(id1)?.name).toBe(newName);
		});

		describe('Undo/Redo of Layer Removal', () => {
			let id2: string, id3: string;

			beforeEach(() => {
				layersManager.addLayer();
				[id2] = layersManager.addLayer();
				[id3] = layersManager.addLayer();
			});

			it('should correctly undo/redo removal of an active middle layer, restoring active state', () => {
				layersManager.setActiveLayer(id2);
				layersManager.removeLayer(id2);
				expect(layersManager.getActiveLayerKey()).toBe(id3);

				historyManager.undo();
				expect(layersManager.getLayer(id2)?.id).toBe(id2);
				expect(layersManager.getLayers().length).toBe(3);
				expect(layersManager.getActiveLayerKey()).toBe(id2);

				historyManager.redo();
				expect(layersManager.getLayer(id2)).toBeNull();
				expect(layersManager.getActiveLayerKey()).toBe(id3);
			});

			it('should correctly undo/redo removal of an active last layer, restoring active state', () => {
				layersManager.removeLayer(id3);
				expect(layersManager.getActiveLayerKey()).toBe(id2);

				historyManager.undo();
				expect(layersManager.getLayer(id3)?.id).toBe(id3);
				expect(layersManager.getActiveLayerKey()).toBe(id3);

				historyManager.redo();
				expect(layersManager.getLayer(id3)).toBeNull();
				expect(layersManager.getActiveLayerKey()).toBe(id2);
			});

			it('should correctly undo/redo removal of the only layer, restoring active state', () => {
				layersManager.clearLayers();
				const [soleId] = layersManager.addLayer();

				layersManager.removeLayer(soleId);
				expect(layersManager.getLayers().length).toBe(0);

				historyManager.undo();
				expect(layersManager.getLayers().length).toBe(1);
				expect(layersManager.getLayer(soleId)?.id).toBe(soleId);
				expect(layersManager.getActiveLayerKey()).toBe(soleId);

				historyManager.redo();
				expect(layersManager.getLayers().length).toBe(0);
			});
		});
	});

	describe('Reactions to External Bus Event Requests', () => {
		describe('Responding to "layer::create::request"', () => {
			it('should create a layer, activate it, and record history when requested via bus', () => {
				const busSpy = vi.spyOn(layersBus, 'emit');
				const historySpy = vi.spyOn(historyManager, 'applyAction');
				expect(layersManager.getLayers().length).toBe(0);

				layersBus.emit('layer::create::request', undefined);

				expect(layersManager.getLayers().length).toBe(1);
				const createdLayerId = layersManager.getActiveLayerKey()!;
				const createdLayer = layersManager.getLayer(createdLayerId)!;

				expect(busSpy).toHaveBeenNthCalledWith(
					2,
					'layer::create::response',
					expect.objectContaining({ id: createdLayerId, name: createdLayer.name, index: 0 })
				);
				expect(busSpy).toHaveBeenNthCalledWith(3, 'layer::change_active::response', {
					id: createdLayerId
				});

				const serializedLayer = layerSerializer.serialize(createdLayer);
				expect(historySpy).toHaveBeenCalledWith(
					{
						type: 'layers::create_and_activate',
						targetId: 'layers',
						before: { layer: null, activeKey: createdLayerId },
						after: { layer: serializedLayer, activeKey: createdLayerId }
					},
					{ applyAction: false }
				);
			});

			it('should correctly undo/redo layer creation triggered by a bus request, managing layers and events', () => {
				const busSpy = vi.spyOn(layersBus, 'emit');
				layersBus.emit('layer::create::request', undefined);
				const createdLayerId = layersManager.getActiveLayerKey()!;

				historyManager.undo();
				expect(layersManager.getLayers().length).toBe(0);
				expect(layersManager.getActiveLayerKey()).toBeNull();
				expect(busSpy).toHaveBeenCalledWith('layer::remove::response', { id: createdLayerId });
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', { id: null });

				historyManager.redo();
				expect(layersManager.getLayers().length).toBe(1);
				expect(layersManager.getActiveLayerKey()).toBe(createdLayerId);

				const redoneLayer = layersManager.getLayer(createdLayerId)!;

				expect(busSpy).toHaveBeenCalledWith(
					'layer::create::response',
					expect.objectContaining({
						id: redoneLayer.id,
						name: redoneLayer.name,
						index: redoneLayer.index
					})
				);
				expect(busSpy).toHaveBeenCalledWith('layer::change_active::response', {
					id: redoneLayer.id
				});
			});
		});

		it('should remove a layer when requested via "layer::remove::request"', () => {
			layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const removeLayerSpy = vi.spyOn(layersManager, 'removeLayer');

			layersBus.emit('layer::remove::request', { id: id2 });
			expect(removeLayerSpy).toHaveBeenCalledWith(id2);
		});

		it('should update a layer and record history when requested via "layer::update::request"', () => {
			const [id1, layer1] = layersManager.addLayer();
			const newName = 'Updated via Bus Request Handler';
			const serializedBefore = layerSerializer.serialize(layer1);
			const historySpy = vi.spyOn(historyManager, 'applyAction');
			const busSpy = vi.spyOn(layersBus, 'emit');

			layersBus.emit('layer::update::request', { id: id1, name: newName });

			const updatedLayer = layersManager.getLayer(id1)!;
			const serializedAfter = layerSerializer.serialize(updatedLayer);

			expect(updatedLayer.name).toBe(newName);
			expect(busSpy).toHaveBeenNthCalledWith(
				2,
				'layer::update::response',
				expect.objectContaining({ id: id1, name: newName })
			);
			expect(historySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'layer::update',
					before: serializedBefore,
					after: serializedAfter
				}),
				{ applyAction: false }
			);
		});

		it('should change the active layer when requested via "layer::change_active::request"', () => {
			const [id1] = layersManager.addLayer();
			layersManager.addLayer();
			const setActiveLayerSpy = vi.spyOn(layersManager, 'setActiveLayer');

			layersBus.emit('layer::change_active::request', { id: id1 });
			expect(setActiveLayerSpy).toHaveBeenCalledWith(id1);
		});
	});
});
