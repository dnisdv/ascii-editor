import { LayersListManager } from './layer-list-manager';
import { Layer, defaultLayerConfig } from './layer';
import { TileMap } from '@editor/tileMap';
import { type ILayer, type ILayerModel } from '@editor/types';
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseBusLayers } from '@editor/bus-layers';

const createLayer = (id: string, index: number = 0, name: string = `Layer ${id}`): ILayer => {
	return new Layer({
		id,
		name,
		index,
		opts: { ...defaultLayerConfig },
		tileMap: new TileMap({ tileSize: 16 }),
		layersBus: new BaseBusLayers()
	});
};

describe('Layers List Manager', () => {
	let manager: LayersListManager;
	let layer1: ILayer, layer2: ILayer, layer3: ILayer;

	beforeEach(() => {
		layer1 = createLayer('id1', 0, 'LayerOne');
		layer2 = createLayer('id2', 0, 'LayerTwo');
		layer3 = createLayer('id3', 0, 'LayerThree');
	});

	describe('Constructor and Initial State', () => {
		it('should initialize empty with no active layer', () => {
			manager = new LayersListManager();
			expect(manager.getSortedLayers()).toEqual([]);
			expect(manager.getActiveLayerKey()).toBeNull();
		});

		it('should initialize with layers, set first as active, and reindex them', () => {
			manager = new LayersListManager([layer1, layer2]);
			manager.setActiveLayer(layer1.id);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(layer1.index).toBe(0);
			expect(layer2.index).toBe(1);
		});
	});

	describe('Adding and Inserting Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager();
		});

		it('should add to empty list, not making it active', () => {
			manager.addLayer(layer1);
			expect(manager.getSortedLayers()).toEqual([layer1]);
			expect(manager.getActiveLayerKey()).toBe(null);
			expect(layer1.index).toBe(0);
		});

		it('should insert into populated list, reindex, and maintain active layer', () => {
			manager.addLayer(layer1);
			manager.setActiveLayer(layer1.id);

			manager.addLayer(layer3);

			manager.insertLayerAtIndex(layer2, 1);

			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(manager.getActiveLayerKey()).toBe(layer1.id);
			expect(layer2.index).toBe(1);
		});

		it('re-adding an existing layer moves it to end and reindexes', () => {
			manager.addLayer(layer1);
			manager.setActiveLayer(layer1.id);
			manager.addLayer(layer2);
			manager.addLayer(layer1);

			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1']);
			expect(manager.getActiveLayerKey()).toBe(layer1.id);
			expect(layer1.index).toBe(1);
		});
	});

	describe('Removing Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager([layer1, layer2, layer3]);
			manager.setActiveLayer(layer1.id);
		});

		it('should remove the active layer, select next as new active, reindex, and return newActive', () => {
			const result = manager.removeLayerWithNewActive('id1');
			expect(result.removed).toBe(true);
			expect(result.newActive).toBe('id2');
			expect(manager.getActiveLayerKey()).toBe('id2');
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3']);
		});

		it('should remove a layer preserving last active and reindex event is the layers was deleted', () => {
			manager.removeLayer('id1');
			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3']);
		});

		it('should remove a non-active layer, reindex, and active layer remains unchanged', () => {
			manager.setActiveLayer(layer3.id);

			const result = manager.removeLayerWithNewActive(layer1.id);
			expect(result.removed).toBe(true);
			expect(manager.getActiveLayerKey()).toBe(layer3.id);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3']);
		});

		it('should remove the only layer, resulting in an empty list and null active layer', () => {
			manager = new LayersListManager([layer1]);
			const result = manager.removeLayerWithNewActive('id1');
			expect(result.removed).toBe(true);
			expect(result.newActive).toBeNull();
			expect(manager.getActiveLayerKey()).toBeNull();
			expect(manager.getSortedLayers()).toEqual([]);
		});
	});

	describe('Moving and Updating Layers', () => {
		beforeEach(() => {
			manager = new LayersListManager([layer1, layer2, layer3]);
			manager.setActiveLayer(layer1.id);
		});

		it('should move a layer, reindex, and keep active layer', () => {
			const success = manager.moveLayerToPosition('id1', 2);
			expect(success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3', 'id1']);
			expect(manager.getActiveLayerKey()).toBe('id1');
			expect(layer1.index).toBe(2);
		});

		it('should update properties, reindex, and return beforeAfter/reindexed', () => {
			const updates: Partial<ILayerModel> = { name: 'Updated L1 Name' };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(result.beforeAfter?.before.name).toBe('LayerOne');
			expect(result.beforeAfter?.after.name).toBe('Updated L1 Name');
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);

			expect(result.reindexed?.length).toBe(3);
			expect(layer1.name).toBe('Updated L1 Name');
		});

		it('should update properties, reorder if visual index changes, call layer.update, and reindex all', () => {
			const updates: Partial<ILayerModel> = { name: 'Moved L1', index: 1 };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1', 'id3']);
			expect(layer1.name).toBe('Moved L1');

			expect(layer2.index).toBe(0);
			expect(layer1.index).toBe(1);
			expect(layer3.index).toBe(2);

			expect(result.beforeAfter?.after.name).toBe('Moved L1');
			expect(result.beforeAfter?.after.index).toBe(1);
			expect(result.reindexed).toEqual([
				{ id: 'id2', index: 0 },
				{ id: 'id1', index: 1 },
				{ id: 'id3', index: 2 }
			]);
		});
	});

	describe('Active Layer Management and Clearing', () => {
		beforeEach(() => {
			manager = new LayersListManager([layer1, layer2]);
			manager.setActiveLayer(layer1.id);
		});

		it('should set active layer and getActiveLayer/Key should reflect it', () => {
			const success = manager.setActiveLayer('id2');
			expect(success).toBe(true);
			expect(manager.getActiveLayerKey()).toBe('id2');
			expect(manager.getActiveLayer()).toBe(layer2);
		});

		it('should fail for non-existent layer, active state unchanged', () => {
			const success = manager.setActiveLayer('nonexistent');
			expect(success).toBe(false);
			expect(manager.getActiveLayerKey()).toBe('id1');
		});

		it('should remove all layers and reset active layer', () => {
			manager.clear();
			expect(manager.getSortedLayers()).toEqual([]);
			expect(manager.hasLayer('id1')).toBe(false);
			expect(manager.getActiveLayerKey()).toBeNull();
		});
	});

	describe('Getters', () => {
		it('should retrieve a layer by its ID', () => {
			manager = new LayersListManager([layer1]);
			expect(manager.getLayerById('id1')).toBe(layer1);
			expect(manager.getLayerById('nonExistentId')).toBeUndefined();
		});

		it('should retrieve the first layer in the sorted list', () => {
			manager = new LayersListManager([layer1, layer2]);
			expect(manager.getFirstLayer()).toBe(layer1);
			manager.moveLayerToPosition('id2', 0);
			expect(manager.getFirstLayer()).toBe(layer2);
		});

		it('should correctly report layer existence', () => {
			manager = new LayersListManager([layer1]);
			expect(manager.hasLayer('id1')).toBe(true);
			expect(manager.hasLayer('nonExistentId')).toBe(false);
		});
	});
});
