import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LayersManager } from '../layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer/layer.serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { BaseSmartObject } from '@editor/objects/smart-object.base';
import { StandardGroupKeys, TransformProperties } from '@editor/objects/properties';
import type { CellRectangle } from '@editor/types';
import type { SmartObjectSerializableSchemaType, SerializedSmartObjectData } from '@editor/serializer/smart-object.schema';
import type { ISmartObject } from '@editor/objects/smart-object.interface';

class TextMock extends BaseSmartObject {
	static readonly type = 'text-mock';
	readonly type = 'text-mock';

	private _text: string;

	constructor(bounds: CellRectangle, text = '') {
		super(bounds, {
			capabilities: { canMove: true, canResize: true, canRotate: false, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: bounds.cellX },
					[TransformProperties.Y]: { type: 'number', value: bounds.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: bounds.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: bounds.height, min: 1 },
				}
			}
		});
		this._text = text;
	}

	toString() { return this._text; }
	toJson() { return { text: this._text }; }
	render(): void {}
	clone(): ISmartObject { return new TextMock({ cellX: this.getProperty('transform.x') as number, cellY: this.getProperty('transform.y') as number, width: this.getProperty('transform.width') as number, height: this.getProperty('transform.height') as number }, this._text); }
	hitTest(): boolean { return false; }
	regionHitTest(): boolean { return false; }

	static deserialize(
		_config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): TextMock {
		const x = fullData?.properties?.transform?.x?.value ?? 0;
		const y = fullData?.properties?.transform?.y?.value ?? 0;
		const width = fullData?.properties?.transform?.width?.value ?? 1;
		const height = fullData?.properties?.transform?.height?.value ?? 1;
		return new TextMock({ cellX: x, cellY: y, width, height }, (data as { text?: string }).text ?? '');
	}
}

function setup() {
	const config = new Config();
	const historyManager = new HistoryManager();
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register(TextMock.type, TextMock);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });
	return { layersManager, historyManager };
}

describe('layer::rasterize_object', () => {
	let layersManager: LayersManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		({ layersManager, historyManager } = setup());
	});

	afterEach(() => {
		layersManager.clearLayers();
	});

	describe('execute', () => {
		it('writes the object toString output to the grid', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 2, cellY: 3, width: 3, height: 1 }, 'ABC');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);

			expect(layer.tileMap.getChar(2, 3)).toBe('A');
			expect(layer.tileMap.getChar(3, 3)).toBe('B');
			expect(layer.tileMap.getChar(4, 3)).toBe('C');
		});

		it('removes the object from the layer', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);

			expect(layer.getObjectById(obj.id)).toBeUndefined();
		});

		it('records one history entry', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
			layer.addObject(obj);
			const before = historyManager.getHistory().length;

			layersManager.rasterizeObject(layerId, obj.id);

			expect(historyManager.getHistory().length).toBe(before + 1);
		});

		it('space chars in the object text do not overwrite existing grid content', () => {
			const [layerId, layer] = layersManager.addLayer();
			layer.grid.setToRegion(3, 5, 'X', { skipSpaces: false });

			const obj = new TextMock({ cellX: 2, cellY: 5, width: 3, height: 1 }, 'A C');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);

			expect(layer.tileMap.getChar(2, 5)).toBe('A');
			expect(layer.tileMap.getChar(3, 5)).toBe('X');
			expect(layer.tileMap.getChar(4, 5)).toBe('C');
		});

		it('throws when the layer does not exist', () => {
			const [,layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
			layer.addObject(obj);

			expect(() => layersManager.rasterizeObject('nonexistent-layer', obj.id)).toThrow();
		});

		it('throws when the object does not exist in the layer', () => {
			const [layerId] = layersManager.addLayer();

			expect(() => layersManager.rasterizeObject(layerId, 'nonexistent-object')).toThrow();
		});
	});

	describe('undo', () => {
		it('restores the object to the layer', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);
			historyManager.undo();

			expect(layer.getObjectById(obj.id)).toBeDefined();
		});

		it('clears the rasterized text from the grid', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 2, cellY: 3, width: 3, height: 1 }, 'ABC');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);
			historyManager.undo();

			expect(layer.tileMap.getChar(2, 3)).toBe(' ');
			expect(layer.tileMap.getChar(3, 3)).toBe(' ');
			expect(layer.tileMap.getChar(4, 3)).toBe(' ');
		});

		it('restores the original grid content that was under the object', () => {
			const [layerId, layer] = layersManager.addLayer();
			layer.grid.setToRegion(2, 3, 'XYZ', { skipSpaces: false });

			const obj = new TextMock({ cellX: 2, cellY: 3, width: 3, height: 1 }, 'ABC');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);
			historyManager.undo();

			expect(layer.tileMap.getChar(2, 3)).toBe('X');
			expect(layer.tileMap.getChar(3, 3)).toBe('Y');
			expect(layer.tileMap.getChar(4, 3)).toBe('Z');
		});

		it('restores the object with its original order key', () => {
			const [layerId, layer] = layersManager.addLayer();
			const objA = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');
			const objB = new TextMock({ cellX: 5, cellY: 0, width: 1, height: 1 }, 'B');
			layer.addObject(objA);
			layer.addObject(objB);

			const originalKeyA = layer.getOrderKey(objA.id);

			layersManager.rasterizeObject(layerId, objA.id);
			historyManager.undo();

			expect(layer.getOrderKey(objA.id)).toBe(originalKeyA);
		});
	});

	describe('redo', () => {
		it('removes the object again after undo+redo', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'X');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);
			historyManager.undo();
			historyManager.redo();

			expect(layer.getObjectById(obj.id)).toBeUndefined();
		});

		it('re-writes the text to the grid after undo+redo', () => {
			const [layerId, layer] = layersManager.addLayer();
			const obj = new TextMock({ cellX: 2, cellY: 3, width: 3, height: 1 }, 'ABC');
			layer.addObject(obj);

			layersManager.rasterizeObject(layerId, obj.id);
			historyManager.undo();
			historyManager.redo();

			expect(layer.tileMap.getChar(2, 3)).toBe('A');
			expect(layer.tileMap.getChar(3, 3)).toBe('B');
			expect(layer.tileMap.getChar(4, 3)).toBe('C');
		});
	});

	describe('multiple objects', () => {
		it('rasterizes two non-overlapping objects to independent grid regions', () => {
			const [layerId, layer] = layersManager.addLayer();
			const objA = new TextMock({ cellX: 0, cellY: 0, width: 3, height: 1 }, 'AAA');
			const objB = new TextMock({ cellX: 10, cellY: 0, width: 3, height: 1 }, 'BBB');
			layer.addObject(objA);
			layer.addObject(objB);

			layersManager.rasterizeObject(layerId, objA.id);
			layersManager.rasterizeObject(layerId, objB.id);

			expect(layer.tileMap.getChar(0, 0)).toBe('A');
			expect(layer.tileMap.getChar(10, 0)).toBe('B');
		});

		it('topmost object chars win at intersections when rasterized top-last', () => {
			const [layerId, layer] = layersManager.addLayer();
			const bottom = new TextMock({ cellX: 0, cellY: 0, width: 3, height: 1 }, 'BOT');
			const top    = new TextMock({ cellX: 0, cellY: 0, width: 3, height: 1 }, 'TOP');
			layer.addObject(bottom);
			layer.addObject(top);

			layersManager.rasterizeObject(layerId, bottom.id);
			layersManager.rasterizeObject(layerId, top.id);

			expect(layer.tileMap.getChar(0, 0)).toBe('T');
			expect(layer.tileMap.getChar(1, 0)).toBe('O');
			expect(layer.tileMap.getChar(2, 0)).toBe('P');
		});
	});
});
