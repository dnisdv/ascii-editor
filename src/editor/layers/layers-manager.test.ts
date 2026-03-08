import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LayersManager } from './layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer/layer.serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';

describe('LayersManager', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;
	let layerSerializer: LayerSerializer;
	let config: Config;

	beforeEach(() => {
		config = new Config();
		historyManager = new HistoryManager();

		const smartObjectsManager = new SmartObjectsManager(config);
		smartObjectsManager.register(MockSmartObject.type, MockSmartObject);

		layerSerializer = new LayerSerializer(smartObjectsManager, config);
		layersManager = new LayersManager({ config, historyManager, layerSerializer });

		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		layersManager.clearLayers();
	});

	describe('Initial State and Basic Properties', () => {
		it('should initialize with an empty layer list and no active layer', () => {
			expect(layersManager.getLayers()).toEqual([]);
			expect(layersManager.getActiveLayerKey()).toBeNull();
			expect(layersManager.getActiveLayer()).toBeNull();
		});

		it('ensureLayer creates a layer when none exists and returns the active layer', () => {
			expect(layersManager.getLayers()).toHaveLength(0);
			const layer = layersManager.ensureLayer();
			expect(layer).toBeTruthy();
			expect(layersManager.getLayers()).toHaveLength(1);
			expect(layersManager.getActiveLayerKey()).toBe(layer.id);
		});
	});

	describe('Core Layer Management', () => {
		it('should add layers and make the latest added one active', () => {
			const [id1, layer1] = layersManager.addLayer();
			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);
			expect(layer1.index).toBe(0);

			const [id2, layer2] = layersManager.addLayer();
			expect(layersManager.getLayers().length).toBe(2);
			expect(layersManager.getActiveLayerKey()).toBe(id2);
			expect(layer1.index).toBe(0);
			expect(layer2.index).toBe(1);
		});

		it('should remove a layer and adjust the active layer accordingly', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const [id3] = layersManager.addLayer();

			layersManager.setActiveLayer(id2);
			layersManager.removeLayer(id2);

			expect(layersManager.getLayers().map((l) => l.id)).toEqual([id1, id3]);
			expect(layersManager.getLayer(id2)).toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(id3);
		});

		it('should remove the last layer and set active to the previous one', () => {
			layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const [id3] = layersManager.addLayer();

			layersManager.setActiveLayer(id3);
			layersManager.removeLayer(id3);

			expect(layersManager.getActiveLayerKey()).toBe(id2);
		});

		it('should have no active layer after removing the only layer', () => {
			const [soleId] = layersManager.addLayer();
			layersManager.removeLayer(soleId);
			expect(layersManager.getLayers().length).toBe(0);
			expect(layersManager.getActiveLayerKey()).toBeNull();
		});
	});

	describe('Setting Active Layer', () => {
		it('should correctly change the active layer', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			layersManager.setActiveLayer(id1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			layersManager.setActiveLayer(id2);
			expect(layersManager.getActiveLayerKey()).toBe(id2);
		});

		it('should not change active layer if the target is already active', () => {
			const [id1] = layersManager.addLayer();
			layersManager.setActiveLayer(id1);

			expect(layersManager.getActiveLayerKey()).toBe(id1);
		});
	});

	describe('Updating Layer Properties', () => {
		it("should update a layer's name", () => {
			const [id1] = layersManager.addLayer();
			const newName = 'Updated Layer Name';
			layersManager.updateLayer(id1, { name: newName });
			expect(layersManager.getLayer(id1)?.name).toBe(newName);
		});

		it("should update a layer's visibility", () => {
			const [id1] = layersManager.addLayer();
			expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(true);
			layersManager.updateLayer(id1, { opts: { visible: false } });
			expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(false);
		});

		it("should update a layer's index and reorder the list", () => {
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
	});

	describe('Event Emission', () => {
		it('should emit `layers::layer::added` and `layer::active::changed` when a layer is added', () => {
			const addedSpy = vi.fn();
			const activeChangeSpy = vi.fn();
			layersManager.on('layer::added', addedSpy);
			layersManager.on('layer::active::changed', activeChangeSpy);

			const [id1] = layersManager.addLayer();

			expect(addedSpy).toHaveBeenCalledOnce();
			expect(addedSpy).toHaveBeenCalledWith({ layer: expect.objectContaining({ id: id1 }) });
			expect(activeChangeSpy).toHaveBeenCalledOnce();
			expect(activeChangeSpy).toHaveBeenCalledWith({ oldId: null, newId: id1 });
		});

		it('should emit `layer::removed` and `layer::active::changed` when an active layer is removed', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			layersManager.setActiveLayer(id1);

			const removedSpy = vi.fn();
			const activeChangeSpy = vi.fn();
			layersManager.on('layer::removed', removedSpy);
			layersManager.on('layer::active::changed', activeChangeSpy);

			layersManager.removeLayer(id1);

			expect(removedSpy).toHaveBeenCalledOnce();
			expect(removedSpy).toHaveBeenCalledWith({ id: id1 });
			expect(activeChangeSpy).toHaveBeenCalledOnce();
			expect(activeChangeSpy).toHaveBeenCalledWith({ oldId: id1, newId: id2 });
		});

		it('should emit `layer::removed` only if the removed layer was not active', () => {
			layersManager.addLayer();
			const [id2] = layersManager.addLayer();
			const [id3] = layersManager.addLayer();
			layersManager.setActiveLayer(id3);

			const removedSpy = vi.fn();
			const activeChangeSpy = vi.fn();
			layersManager.on('layer::removed', removedSpy);
			layersManager.on('layer::active::changed', activeChangeSpy);

			layersManager.removeLayer(id2);

			expect(removedSpy).toHaveBeenCalledOnce();
			expect(removedSpy).toHaveBeenCalledWith({ id: id2 });
			expect(activeChangeSpy).not.toHaveBeenCalled();
		});

		it('should emit `layer::active::changed` when changing the active layer', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			const activeChangeSpy = vi.fn();
			layersManager.on('layer::active::changed', activeChangeSpy);

			layersManager.setActiveLayer(id1);

			expect(activeChangeSpy).toHaveBeenCalledOnce();
			expect(activeChangeSpy).toHaveBeenCalledWith({ oldId: id2, newId: id1 });
		});

		it('should not emit `layer::active::changed` if the active layer is changing to itself', () => {
			const [id1] = layersManager.addLayer();
			layersManager.setActiveLayer(id1);

			const activeChangeSpy = vi.fn();
			layersManager.on('layer::active::changed', activeChangeSpy);

			layersManager.setActiveLayer(id1);

			expect(activeChangeSpy).not.toHaveBeenCalled();
		});
	});

	describe('History', () => {
		it('should move layer object with history and restore original orderKey on undo/redo', () => {
			const [layerId, layer] = layersManager.addLayer();

			const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');
			const C = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'C');

			layer.addObject(A, { orderKey: 'a0a' });
			layer.addObject(B, { orderKey: 'a0m' });
			layer.addObject(C, { orderKey: 'a0z' });

			const keyB0 = layer.getOrderKey('B')!;
			expect(keyB0).toBe('a0m');
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);

			layersManager.moveLayerObject(layerId, 'B', 0);
			expect(layer.getObjects().map((o) => o.id)[0]).toBe('B');
			const keyB1 = layer.getOrderKey('B')!;
			expect(keyB1).not.toBe(keyB0);

			historyManager.undo();
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B', 'C']);
			expect(layer.getOrderKey('B')).toBe(keyB0);

			historyManager.redo();
			expect(layer.getObjects().map((o) => o.id)[0]).toBe('B');
			expect(layer.getOrderKey('B')).toBe(keyB1);
		});

		it('should remove layer object with history and restore same orderKey on undo/redo', () => {
			const [layerId, layer] = layersManager.addLayer();

			const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			const B = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'B');

			layer.addObject(A, { orderKey: 'a0m' });
			layer.addObject(B, { orderKey: 'a0z' });

			const keyA = layer.getOrderKey('A');
			const indexA = layer.getIndexOfObject('A');
			expect(keyA).toBe('a0m');
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B']);

			layersManager.removeLayerObject(layerId, 'A');
			expect(layer.getObjectById('A')).toBeUndefined();
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'B']);

			historyManager.undo();
			expect(layer.getObjectById('A')).toBeTruthy();
			expect(layer.getOrderKey('A')).toBe(keyA);
			expect(layer.getIndexOfObject('A')).toBe(indexA);
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'A', 'B']);

			historyManager.redo();
			expect(layer.getObjectById('A')).toBeUndefined();
			expect(layer.getObjects().map((o) => o.id)).toEqual(['default-text-grid', 'B']);
		});

		it('should rename layer object with history and undo/redo correctly', () => {
			const [layerId, layer] = layersManager.addLayer();
			const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			layer.addObject(A, { orderKey: 'a0m' });

			const initialName = A.getName();
			expect(initialName).toBeTruthy();

			layersManager.renameLayerObject(layerId, 'A', 'Renamed');
			expect(A.getName()).toBe('Renamed');

			historyManager.undo();
			expect(A.getName()).toBe(initialName);

			historyManager.redo();
			expect(A.getName()).toBe('Renamed');
		});

		it('should rename temp layer object with history and undo/redo correctly', () => {
			const [tempLayerId, tempLayer] = layersManager.addOverlayTempLayer();
			const A = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			tempLayer.addObject(A, { orderKey: 'a0m' });

			const initialName = A.getName();
			expect(initialName).toBeTruthy();

			layersManager.renameLayerObject(tempLayerId, 'A', 'Renamed');
			expect(A.getName()).toBe('Renamed');

			historyManager.undo();
			expect(A.getName()).toBe(initialName);

			historyManager.redo();
			expect(A.getName()).toBe('Renamed');
		});

		it('should rename across composition (real + attached temp clone) with history', () => {
			const [realId, real] = layersManager.addLayer();
			const realObj = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			real.addObject(realObj, { orderKey: 'a0m' });

			const [, temp] = layersManager.addTempLayer(realId);
			const tempClone = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			temp.addOrReplaceObject(tempClone, { orderKey: 'a0a' });

			const initialName = realObj.getName();
			expect(initialName).toBeTruthy();
			expect(tempClone.getName()).toBe(initialName);

			layersManager.renameLayerObject(realId, 'A', 'Renamed');
			expect(realObj.getName()).toBe('Renamed');
			expect(tempClone.getName()).toBe('Renamed');

			historyManager.undo();
			expect(realObj.getName()).toBe(initialName);
			expect(tempClone.getName()).toBe(initialName);

			historyManager.redo();
			expect(realObj.getName()).toBe('Renamed');
			expect(tempClone.getName()).toBe('Renamed');
		});

		it('should rename object that exists only in attached temp layer (shape-tool flow)', () => {
			const [realId] = layersManager.addLayer();
			const [, temp] = layersManager.addTempLayer(realId);
			const tempOnly = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			temp.addOrReplaceObject(tempOnly, { orderKey: 'a0m' });

			const initialName = tempOnly.getName();
			expect(initialName).toBeTruthy();
			layersManager.renameLayerObject(realId, 'A', 'Renamed');
			expect(tempOnly.getName()).toBe('Renamed');

			historyManager.undo();
			expect(tempOnly.getName()).toBe(initialName);

			historyManager.redo();
			expect(tempOnly.getName()).toBe('Renamed');
		});

		it('should undo/redo rename correctly after delete/restore and temp layer changes', () => {
			const [realId, real] = layersManager.addLayer();
			const realObj = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			real.addObject(realObj, { orderKey: 'a0m' });
			const initialName = realObj.getName();

			const [tempId1, temp1] = layersManager.addTempLayer(realId);
			const clone1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			temp1.addOrReplaceObject(clone1, { orderKey: 'a0a' });

			layersManager.renameLayerObject(realId, 'A', 'Renamed');
			expect(realObj.getName()).toBe('Renamed');
			expect(clone1.getName()).toBe('Renamed');

			layersManager.removeTempLayer(tempId1);

			layersManager.removeLayerObject(realId, 'A');
			expect(real.getObjectById('A')).toBeUndefined();
			historyManager.undo();
			const restored = real.getObjectById('A');
			expect(restored).toBeTruthy();

			const [, temp2] = layersManager.addTempLayer(realId);
			const clone2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			temp2.addOrReplaceObject(clone2, { orderKey: 'a0a' });

			historyManager.undo();
			expect(
				(real.getObjectById('A')?.getProperty('meta.name') as string | undefined) ?? initialName
			).toBe(initialName);
			expect(clone2.getName()).toBe(initialName);

			historyManager.redo();
			expect(real.getObjectById('A')?.getProperty('meta.name')).toBe('Renamed');
			expect(clone2.getName()).toBe('Renamed');
		});

		it('should handle correct history when a layer is added and activated by undo-ing/redo-ing it', () => {
			const [id1] = layersManager.addLayer();
			expect(historyManager.getHistory().length).toBe(1);

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getLayer(id1)).not.toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.undo();

			expect(layersManager.getLayers().length).toBe(0);
			expect(layersManager.getLayer(id1)).toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(null);

			historyManager.redo();

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getLayer(id1)).not.toBeNull();
			expect(layersManager.getActiveLayerKey()).toBe(id1);
		});

		it('should handle correct history when a layer is updated by undo-ing/redo-ing it', () => {
			const [id1] = layersManager.addLayer();

			const defaultLayerModel = {
				name: layersManager.getLayer(id1)?.name,
				index: layersManager.getLayer(id1)?.index,
				opts: layersManager.getLayer(id1)?.getOpts()
			};

			layersManager.updateLayer(id1, {
				name: 'update_1',
				index: 0,
				opts: { visible: true, locked: false }
			});
			expect(layersManager.getLayer(id1)?.name).toBe('update_1');
			expect(layersManager.getLayer(id1)?.index).toBe(0);
			expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(true);
			expect(layersManager.getLayer(id1)?.getOpts().locked).toBe(false);

			historyManager.undo();

			expect(layersManager.getLayer(id1)?.name).toBe(defaultLayerModel.name);
			expect(layersManager.getLayer(id1)?.index).toBe(defaultLayerModel.index);
			expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(defaultLayerModel.opts?.visible);
			expect(layersManager.getLayer(id1)?.getOpts().locked).toBe(defaultLayerModel.opts?.locked);

			historyManager.redo();

			expect(layersManager.getLayer(id1)?.name).toBe('update_1');
			expect(layersManager.getLayer(id1)?.index).toBe(0);
			expect(layersManager.getLayer(id1)?.getOpts().visible).toBe(true);
			expect(layersManager.getLayer(id1)?.getOpts().locked).toBe(false);
		});

		it('should handle correct history when an active layer is changing', () => {
			const [id1] = layersManager.addLayer();

			const [id2] = layersManager.addLayer();
			expect(layersManager.getActiveLayerKey()).toBe(id2);

			historyManager.undo();
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.redo();
			expect(layersManager.getActiveLayerKey()).toBe(id2);
		});

		it('should handle correct history when only layer is removed and activated layer set to null by undo-ing/redo-ing it', () => {
			const [id1] = layersManager.addLayer();
			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			layersManager.removeLayer(id1);

			expect(layersManager.getLayers().length).toBe(0);
			expect(layersManager.getActiveLayerKey()).toBe(null);

			historyManager.undo();

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.redo();

			expect(layersManager.getLayers().length).toBe(0);
			expect(layersManager.getActiveLayerKey()).toBe(null);
		});

		it('should handle correct history when layer is removed and activated by undo-ing/redo-ing it', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			expect(layersManager.getLayers().length).toBe(2);
			expect(layersManager.getActiveLayerKey()).toBe(id2);

			layersManager.removeLayer(id2);

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.undo();

			expect(layersManager.getLayers().length).toBe(2);
			expect(layersManager.getActiveLayerKey()).toBe(id2);

			historyManager.redo();

			expect(layersManager.getLayers().length).toBe(1);
			expect(layersManager.getActiveLayerKey()).toBe(id1);
		});

		it('should handle correct history restoring the layer with all his data', () => {
			const [id1] = layersManager.addLayer();
			const [id2] = layersManager.addLayer();

			const activeLayer = layersManager.getLayer(id2);

			expect(activeLayer!.id).toBe(id2);

			activeLayer?.grid.setChar(0, 0, 'A');
			activeLayer?.grid.setChar(1, 1, 'B');

			layersManager.removeLayer(id2);
			expect(layersManager.getLayer(id2)).toBe(null);

			expect(layersManager.getActiveLayerKey()).toBe(id1);

			historyManager.undo();

			expect(layersManager.getActiveLayerKey()).toBe(id2);
			expect(layersManager.getLayer(id2)?.grid.getChar(0, 0)).toBe('A');
			expect(layersManager.getLayer(id2)?.grid.getChar(1, 1)).toBe('B');

			historyManager.redo();
			expect(layersManager.getLayer(id2)).toBe(null);
		});
	});

	describe('Temp Layers and Composition', () => {
		it('getLayerComposition for a temp layer id returns only that temp layer', () => {
			const [realId] = layersManager.addLayer();
			const [tempId] = layersManager.addTempLayer(realId);
			const comp = layersManager.getLayerComposition(tempId);
			expect(comp.map((l) => l.id)).toEqual([tempId]);
		});

		it('addTempLayer throws if source layer does not exist', () => {
			expect(() => layersManager.addTempLayer('missing-layer')).toThrow();
		});

		it('getVisibleLayers/getVisibleTempLayers filter by opts.visible', () => {
			const [realId] = layersManager.addLayer();
			const [tempId] = layersManager.addTempLayer(realId);

			expect(layersManager.getVisibleLayers().map((l) => l.id)).toContain(realId);
			expect(layersManager.getVisibleTempLayers().map((l) => l.id)).toContain(tempId);

			layersManager.updateLayer(realId, { opts: { visible: false } });
			const tempLayer = layersManager._getTempLayerInternal(tempId)!;
			tempLayer.update({ opts: { visible: false } });

			expect(layersManager.getVisibleLayers().map((l) => l.id)).not.toContain(realId);
			expect(layersManager.getVisibleTempLayers().map((l) => l.id)).not.toContain(tempId);
		});

		it('_clearTempLayersInternal removes all temp layers', () => {
			const [realId] = layersManager.addLayer();
			layersManager.addTempLayer(realId);
			layersManager.addTempLayer(realId);
			expect(layersManager._getTempLayersInternal().length).toBeGreaterThan(0);
			layersManager._clearTempLayersInternal();
			expect(layersManager._getTempLayersInternal()).toEqual([]);
		});

		it('addTempLayer attaches to a real layer and shares its index; removeTempLayer detaches', () => {
			const [realId, real] = layersManager.addLayer();
			const realIndex = real.index;
			const [tempId, temp] = layersManager.addTempLayer(realId);

			expect(layersManager.getAttachedTempLayers(realId)).toContain(tempId);
			expect(temp.index).toBe(realIndex);

			const comp0 = layersManager.getLayerComposition(realId).map((l) => l.id);
			expect(comp0).toContain(realId);
			expect(comp0).toContain(tempId);

			layersManager.removeTempLayer(tempId);
			expect(layersManager.getAttachedTempLayers(realId)).not.toContain(tempId);
			const comp1 = layersManager.getLayerComposition(realId).map((l) => l.id);
			expect(comp1).toContain(realId);
			expect(comp1).not.toContain(tempId);
		});

		it('addOverlayTempLayer is visible but not part of any real-layer composition', () => {
			const [realId, real] = layersManager.addLayer();
			real.addObject(new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'R1'), {
				orderKey: 'a0m'
			});

			const [overlayId, overlay] = layersManager.addOverlayTempLayer(real.index);
			overlay.addOrReplaceObject(
				new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'OV1'),
				{ orderKey: 'a0a' }
			);

			const api = layersManager.getLayer(realId)!;
			expect(api.getObjects().map((o) => o.id)).not.toContain('OV1');

			const visibleIds = layersManager.getAllVisibleLayersSorted().map((l) => l.id);
			expect(visibleIds).toContain(realId);
			expect(visibleIds).toContain(overlayId);
		});

		it('getAllVisibleLayersSorted orders temp before real when indices are equal', () => {
			const [realId] = layersManager.addLayer();
			const [tempId] = layersManager.addTempLayer(realId);
			const ids = layersManager.getAllVisibleLayersSorted().map((l) => l.id);
			const tempPos = ids.indexOf(tempId);
			const realPos = ids.indexOf(realId);
			expect(tempPos).toBeGreaterThanOrEqual(0);
			expect(realPos).toBeGreaterThanOrEqual(0);
			expect(tempPos).toBeLessThan(realPos);
		});
	});

	describe('Tile Composition', () => {
		it('getCombinedTileData uses getAllVisibleLayersSorted precedence (earlier layer wins)', () => {
			const [realId, real] = layersManager.addLayer();
			const [tempId] = layersManager.addTempLayer(realId);
			const tempLayer = layersManager._getTempLayerInternal(tempId)!;

			real.grid.setChar(0, 0, 'R');
			tempLayer.grid.setChar(0, 0, 'T');

			const composed = layersManager.getCombinedTileData(0, 0);
			expect(composed[0]).toBe('T');
		});
	});
});
