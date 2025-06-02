import { TempLayersListManager } from './templayer-list-manager';
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

describe('Temp Layers List Manager', () => {
	let manager: TempLayersListManager;
	let layer1: ILayer, layer2: ILayer, layer3: ILayer;

	beforeEach(() => {
		layer1 = createLayer('id1', 0, 'LayerOne');
		layer2 = createLayer('id2', 1, 'LayerTwo');
		layer3 = createLayer('id3', 2, 'LayerThree');
	});

	describe('Constructor and Initial State', () => {
		it('should initialize empty', () => {
			manager = new TempLayersListManager();
			expect(manager.getSortedLayers()).toEqual([]);
		});

		it('should initialize with given layers, maintaining order and original layer indices', () => {
			manager = new TempLayersListManager([layer1, layer2]);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
			expect(manager.getLayerById('id1')?.index).toBe(0);
			expect(manager.getLayerById('id2')?.index).toBe(1);
		});
	});

	describe('Adding and Inserting Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager();
		});

		it('should add layer to end; layer.index property remains unchanged', () => {
			manager.addLayer(layer1);
			manager.addLayer(layer2);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
			expect(layer1.index).toBe(0);
			expect(layer2.index).toBe(1);
		});

		it('should insert layer at specified visual index; layer.index property remains unchanged', () => {
			manager.addLayer(layer1);
			manager.addLayer(layer3);
			manager.insertLayerAtIndex(layer2, 1);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(layer2.index).toBe(1);
		});

		it('re-adding an existing layer moves it to end; layer.index property remains unchanged', () => {
			manager.addLayer(layer1);
			manager.addLayer(layer2);
			manager.addLayer(layer1);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1']);
			expect(layer1.index).toBe(0);
		});

		it('should add multiple layers to the end, preserving their original layer indices', () => {
			manager.addLayer(layer1);
			manager.addMultipleLayers([layer2, layer3]);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(layer2.index).toBe(1);
			expect(layer3.index).toBe(2);
		});
	});

	describe('Removing Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2, layer3]);
		});

		it('should remove an existing layer and return removed status', () => {
			const result = manager.removeLayer('id2');
			expect(result.removed).toBe(true);
			expect(manager.hasLayer('id2')).toBe(false);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id3']);
		});

		it('should remove the only layer, resulting in an empty list', () => {
			manager = new TempLayersListManager([layer1]);
			const result = manager.removeLayer('id1');
			expect(result.removed).toBe(true);
			expect(manager.getSortedLayers()).toEqual([]);
		});

		it('should return removed: false for a non-existent layer', () => {
			const result = manager.removeLayer('nonexistent');
			expect(result.removed).toBe(false);
			expect(manager.getSortedLayers().length).toBe(3);
		});
	});

	describe('Moving and Updating Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2, layer3]);
		});

		it('should move a layer, layer.index properties remain unchanged', () => {
			const success = manager.moveLayerToPosition('id1', 2);
			expect(success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3', 'id1']);
			expect(layer1.index).toBe(0);
		});

		it('should update visual order if updates.index differs from current visual index; layer properties unchanged by manager', () => {
			const updates: Partial<ILayerModel> = { index: 1 };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1', 'id3']);
			expect(layer1.index).toBe(0);
			expect(result.beforeAfter).toBeUndefined();
			expect(result.reindexed).toBeUndefined();
		});

		it('should not change visual order if updates.index is same as current visual index', () => {
			const updates: Partial<ILayerModel> = { index: 0 };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(layer1.index).toBe(0);
		});

		it('should not change visual order if updates.index is undefined; layer properties unchanged by manager', () => {
			const updates: Partial<ILayerModel> = { name: 'New Name for L1' };
			const result = manager.updateLayer('id1', updates);

			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
			expect(layer1.index).toBe(0);
		});
	});

	describe('Clearing and Getters', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2]);
		});

		it('should clear all layers', () => {
			manager.clear();
			expect(manager.getSortedLayers()).toEqual([]);
			expect(manager.hasLayer('id1')).toBe(false);
		});

		it('should retrieve a layer by its ID', () => {
			expect(manager.getLayerById('id1')).toBe(layer1);
			expect(manager.getLayerById('nonexistent')).toBeUndefined();
		});

		it('should retrieve the first visually sorted layer', () => {
			expect(manager.getFirstLayer()).toBe(layer1);
			manager.moveLayerToPosition('id2', 0);
			expect(manager.getFirstLayer()).toBe(layer2);
		});

		it('should correctly report layer existence', () => {
			expect(manager.hasLayer('id1')).toBe(true);
			expect(manager.hasLayer('nonexistent')).toBe(false);
		});
	});
});
