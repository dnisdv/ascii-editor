import { TempLayersListManager } from './templayer-list-manager';
import { defaultLayerConfig, Layer } from './layer';
import { describe, it, expect, beforeEach } from 'vitest';
import { Config } from '@editor/config';
import type { ILayerModel } from '@editor/types/external/layer-model';

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

describe('TempLayersListManager', () => {
	let manager: TempLayersListManager;
	let layer1: Layer, layer2: Layer, layer3: Layer;

	beforeEach(() => {
		layer1 = createLayer('id1', 0, 'LayerOne');
		layer2 = createLayer('id2', 0, 'LayerTwo');
		layer3 = createLayer('id3', 0, 'LayerThree');
	});

	describe('Constructor and Initial State', () => {
		it('should initialize empty', () => {
			manager = new TempLayersListManager();
			expect(manager.getSortedLayers()).toEqual([]);
		});

		it('should initialize with an array of layers', () => {
			manager = new TempLayersListManager([layer1, layer2]);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
		});
	});

	describe('Adding and Inserting Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager();
		});

		it('should add a layer to an empty list', () => {
			manager.addLayer(layer1);
			expect(manager.getSortedLayers()).toEqual([layer1]);
		});

		it('should add multiple layers to the list', () => {
			manager.addMultipleLayers([layer1, layer2]);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2']);
		});

		it('should insert a layer at a specific index', () => {
			manager.addLayer(layer1);
			manager.addLayer(layer3);
			manager.insertLayerAtIndex(layer2, 1);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id2', 'id3']);
		});

		it('re-adding an existing layer should move it to the end of the list', () => {
			manager.addLayer(layer1);
			manager.addLayer(layer2);
			manager.addLayer(layer1);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1']);
		});
	});

	describe('Removing Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2, layer3]);
		});

		it('should remove a layer successfully', () => {
			const result = manager.removeLayer('id2');
			expect(result.removed).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id1', 'id3']);
		});

		it('should return removed: false for a non-existent layer', () => {
			const result = manager.removeLayer('non-existent');
			expect(result.removed).toBe(false);
			expect(manager.getSortedLayers().length).toBe(3);
		});

		it('should remove the only layer, resulting in an empty list', () => {
			manager = new TempLayersListManager([layer1]);
			const result = manager.removeLayer('id1');
			expect(result.removed).toBe(true);
			expect(manager.getSortedLayers()).toEqual([]);
		});
	});

	describe('Moving and Updating Layers', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2, layer3]);
		});

		it('should move a layer to a new position', () => {
			const success = manager.moveLayerToPosition('id1', 2);
			expect(success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id3', 'id1']);
		});

		it('should return false when trying to move a non-existent layer', () => {
			const success = manager.moveLayerToPosition('non-existent', 1);
			expect(success).toBe(false);
		});

		it("should update a layer's index", () => {
			const updates: Partial<ILayerModel> = { index: 1 };
			const result = manager.updateLayer('id1', updates);
			expect(result.success).toBe(true);
			expect(manager.getSortedLayers().map((l) => l.id)).toEqual(['id2', 'id1', 'id3']);
		});
	});

	describe('Clearing the list', () => {
		it('should remove all layers from the list', () => {
			manager = new TempLayersListManager([layer1, layer2]);
			manager.clear();
			expect(manager.getSortedLayers()).toEqual([]);
		});
	});

	describe('Getters', () => {
		beforeEach(() => {
			manager = new TempLayersListManager([layer1, layer2]);
		});

		it('should retrieve a layer by its ID', () => {
			expect(manager.getLayerById('id1')).toBe(layer1);
			expect(manager.getLayerById('nonExistentId')).toBeUndefined();
		});

		it('should retrieve the first layer in the sorted list', () => {
			expect(manager.getFirstLayer()).toBe(layer1);
		});

		it('should correctly report if a layer exists', () => {
			expect(manager.hasLayer('id1')).toBe(true);
			expect(manager.hasLayer('nonExistentId')).toBe(false);
		});
	});
});
