import { LayersListManager } from './layer-list-manager';
import { defaultLayerConfig, Layer } from './layer';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Config } from '@editor/config';
import type { ILayerModel } from '@editor/types/external/layer-model';
import { ScopeIndexAllocator } from './scope-index-allocator';

const config = new Config();
const createLayer = (id: string, index: number = 0, name: string = `Layer ${id}`): Layer => {
	return new Layer({
		id,
		name,
		config: config,
		index,
		opts: { ...defaultLayerConfig }
	});
};

describe('Layers List Manager', () => {
	let manager: LayersListManager;
	let layer1: Layer, layer2: Layer, layer3: Layer;

	beforeEach(() => {
		layer1 = createLayer('id1', 0, 'LayerOne');
		layer2 = createLayer('id2', 0, 'LayerTwo');
		layer3 = createLayer('id3', 0, 'LayerThree');
	});

	describe('Constructor and Initial State', () => {
		it('should initialize empty with no active layer', () => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			expect(manager.getSortedLayers()).toEqual([]);
			expect(manager.getActiveLayerKey()).toBeNull();
		});

		it('should add multiple layers at once, re-indexing them in order', () => {
			const onLayerAdded = vi.fn();
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.on('layer::added', onLayerAdded);
			manager.addMultipleLayers([layer1, layer2]);

			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
			expect(layer1.index).toBe(0);
			expect(layer2.index).toBe(1);
			expect(onLayerAdded).toHaveBeenCalledTimes(2);
			expect(onLayerAdded).toHaveBeenCalledWith({ layer: layer1 });
			expect(onLayerAdded).toHaveBeenCalledWith({ layer: layer2 });
		});
	});

	describe('Adding and Inserting Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
		});

		it('should add to empty list, not making it active, and emit `layer::added`', () => {
			const onLayerAdded = vi.fn();
			manager.on('layer::added', onLayerAdded);
			manager.addLayer(layer1);

			expect(manager.getSortedLayers()).toEqual([layer1]);
			expect(manager.getActiveLayerKey()).toBe(null);
			expect(layer1.index).toBe(0);
			expect(onLayerAdded).toHaveBeenCalledWith({ layer: layer1 });
		});

		it('should insert into populated list, maintain active layer, and emit `layer::added`', () => {
			manager.addLayer(layer1);
			manager.setActiveLayer(layer1.id);
			manager.addLayer(layer3);

			const onLayerAdded = vi.fn();
			manager.on('layer::added', onLayerAdded);
			manager.insertLayerAtIndex(layer2, 1);

			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(manager.getActiveLayerKey()).toBe(layer1.id);
			// insertLayerAtIndex preserves the layer's own index (used for undo/restore)
			expect(layer2.index).toBe(0);
			expect(onLayerAdded).toHaveBeenCalledWith({ layer: layer2 });
		});

		it('re-adding an existing layer moves it to end, reindexes, and emits `layer::added`', () => {
			manager.addLayer(layer1);
			manager.setActiveLayer(layer1.id);
			manager.addLayer(layer2);

			const onLayerAdded = vi.fn();
			manager.on('layer::added', onLayerAdded);
			manager.addLayer(layer1);

			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1']);
			expect(manager.getActiveLayerKey()).toBe(layer1.id);
			// nextScopeIndex: max sibling index (layer2.index=1) + 1 = 2
			expect(layer1.index).toBe(2);
			expect(onLayerAdded).toHaveBeenCalledWith({ layer: layer1 });
		});
	});

	describe('Removing Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1, layer2, layer3]);
			manager.setActiveLayer(layer1.id);
		});

		it('should remove the active layer, select next as new active, reindex, and emit `layer::removed` and `active::changed`', () => {
			const onLayerRemoved = vi.fn();
			const onActiveChanged = vi.fn();
			manager.on('layer::removed', onLayerRemoved);
			manager.on('layer::active::changed', onActiveChanged);

			const result = manager.removeLayerWithNewActive('id1');
			expect(result.removed).toBe(true);
			expect(result.newActive).toBe('id2');
			expect(manager.getActiveLayerKey()).toBe('id2');
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3']);
			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id1' });
			expect(onActiveChanged).toHaveBeenCalledWith({ oldId: 'id1', newId: 'id2' });
		});

		it('should remove a non-active layer while preserving the active layer', () => {
			const onLayerRemoved = vi.fn();
			manager.on('layer::removed', onLayerRemoved);
			manager.removeLayer('id2');

			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id3']);
			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id2' });
		});

		it('should remove a non-active layer, reindex, active layer remains unchanged, and emit `layer::removed`', () => {
			manager.setActiveLayer(layer3.id);
			const onLayerRemoved = vi.fn();
			manager.on('layer::removed', onLayerRemoved);

			const result = manager.removeLayerWithNewActive(layer1.id);
			expect(result.removed).toBe(true);
			expect(manager.getActiveLayerKey()).toBe(layer3.id);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3']);
			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id1' });
		});

		it('should remove the only layer, resulting in an empty list and null active layer', () => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1]);
			manager.setActiveLayer(layer1.id);

			const onLayerRemoved = vi.fn();
			const onActiveChanged = vi.fn();
			manager.on('layer::removed', onLayerRemoved);
			manager.on('layer::active::changed', onActiveChanged);

			const result = manager.removeLayerWithNewActive('id1');
			expect(result.removed).toBe(true);
			expect(result.newActive).toBeNull();
			expect(manager.getActiveLayerKey()).toBeNull();
			expect(manager.getSortedLayers()).toEqual([]);

			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id1' });
			expect(onActiveChanged).toHaveBeenCalledWith({ oldId: 'id1', newId: null });
		});
	});

	describe('Moving and Updating Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1, layer2, layer3]);
			manager.setActiveLayer(layer1.id);
		});

		it('should move a layer, reindex, and keep active layer', () => {
			const success = manager.moveLayerToPosition('id1', 2);
			expect(success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3', 'id1']);
			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(layer1.index).toBe(2);
		});

		it("should update a layer's properties without changing its position", () => {
			const updates: Partial<ILayerModel> = { name: 'Updated L1 Name' };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(layer1.name).toBe('Updated L1 Name');
		});

		it('should update index directly without reindexing siblings', () => {
			const updates: Partial<ILayerModel> = { name: 'Moved L1', index: 1 };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(layer1.name).toBe('Moved L1');
			expect(layer1.index).toBe(1);
			// Siblings are not reindexed — indices are scope-local
			expect(layer2.index).toBe(1);
			expect(layer3.index).toBe(2);
		});
	});

	describe('Active Layer Management and Clearing', () => {
		beforeEach(() => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1, layer2]);
			manager.setActiveLayer(layer1.id);
		});

		it('should set active layer, emit `active::changed`, and getActiveLayer/Key should reflect it', () => {
			const onActiveChanged = vi.fn();
			manager.on('layer::active::changed', onActiveChanged);
			const success = manager.setActiveLayer('id2');

			expect(success).toBe(true);
			expect(manager.getActiveLayerKey()).toBe('id2');
			expect(manager.getActiveLayer()).toBe(layer2);
			expect(onActiveChanged).toHaveBeenCalledWith({ oldId: 'id1', newId: 'id2' });
		});

		it('should fail for non-existent layer, active state unchanged and no event emitted', () => {
			const onActiveChanged = vi.fn();
			manager.on('layer::active::changed', onActiveChanged);
			const success = manager.setActiveLayer('nonexistent');

			expect(success).toBe(false);
			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(onActiveChanged).not.toHaveBeenCalled();
		});

		it('should remove all layers, reset active layer and emit `layer::removed` for each', () => {
			const onLayerRemoved = vi.fn();
			manager.on('layer::removed', onLayerRemoved);
			manager.clear();

			expect(manager.getSortedLayers()).toEqual([]);
			expect(manager.hasLayer('id1')).toBe(false);
			expect(manager.getActiveLayerKey()).toBeNull();
			expect(onLayerRemoved).toHaveBeenCalledTimes(2);
			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id1' });
			expect(onLayerRemoved).toHaveBeenCalledWith({ id: 'id2' });
		});
	});

	describe('Getters', () => {
		it('should retrieve a layer by its ID', () => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1]);
			expect(manager.getLayerById('id1')).toBe(layer1);
			expect(manager.getLayerById('nonExistentId')).toBeUndefined();
		});

		it('should retrieve the first layer in the sorted list', () => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1, layer2]);
			expect(manager.getFirstLayer()).toBe(layer1);
			manager.moveLayerToPosition('id2', 0);
			expect(manager.getFirstLayer()).toBe(layer2);
		});

		it('should correctly report layer existence', () => {
			manager = new LayersListManager(ScopeIndexAllocator.forLayers(() => manager.getSortedLayers()));
			manager.addMultipleLayers([layer1]);
			expect(manager.hasLayer('id1')).toBe(true);
			expect(manager.hasLayer('nonExistentId')).toBe(false);
		});
	});
});
