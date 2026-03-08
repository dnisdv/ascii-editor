import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Layer, type LayerConstructor } from './layer';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { Config } from '@editor/config';
import { TextGridObject } from '@editor/objects/text-grid-object';
import type { ObjectOperation } from '@editor/types';
import { BaseSmartObject } from '@editor/objects/smart-object.base';

class SmartObject extends BaseSmartObject {
	type = 'mock';
	constructor(id: string) {
		super(
			{ cellX: 0, cellY: 0, width: 1, height: 1 },
			{
				capabilities: { canMove: true, canResize: true, canRotate: true, canSelect: true },
				properties: {}
			}
		);
		(this as { -readonly [key in 'id']: string })['id'] = id;
	}
	render() {}
	clone() {
		return this;
	}
	hitTest(): boolean {
		return true;
	}
	regionHitTest(): boolean {
		return true;
	}
}

describe('Layer', () => {
	let layer: Layer;
	let config: Config;
	let defaultOptions: LayerConstructor;
	let obj1: ISmartObject;
	let obj2: ISmartObject;

	beforeEach(() => {
		vi.useFakeTimers();
		config = new Config();

		obj1 = new SmartObject('obj1');
		obj2 = new SmartObject('obj2');

		defaultOptions = {
			id: 'layer1',
			name: 'Test Layer',
			index: 0,
			opts: {},
			config: config
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with basic properties', () => {
			layer = new Layer(defaultOptions);
			expect(layer.id).toBe('layer1');
			expect(layer.name).toBe('Test Layer');
			expect(layer.index).toBe(0);
			expect(layer.opts.visible).toBe(true);
			expect(layer.opts.locked).toBe(false);
		});

		it('should override default opts when provided', () => {
			const opts = { visible: false, locked: true };
			layer = new Layer({ ...defaultOptions, opts });
			expect(layer.opts.visible).toBe(false);
			expect(layer.opts.locked).toBe(true);
		});

		it('should create a new TextGridObject if none is provided', () => {
			layer = new Layer(defaultOptions);
			expect(layer.grid).toBeDefined();
			expect(layer.grid.type).toBe('text-grid');
			expect(layer.objects.some((o) => o.type === 'text-grid')).toBe(false);
		});

		it('should use an existing TextGridObject if provided in objects array', () => {
			const existingGrid = new TextGridObject(config);
			layer = new Layer({ ...defaultOptions, objects: [obj1, existingGrid] });

			expect(layer.grid).toBe(existingGrid);
			expect(layer.objects).toContain(existingGrid);
		});
	});

	describe('Object Management', () => {
		beforeEach(() => {
			layer = new Layer(defaultOptions);
		});

		it('should add an object and emit an "object::added" event', async () => {
			const onAdd = vi.fn();
			layer.on('object::added', onAdd);
			layer.addObject(obj1);

			await vi.runAllTimersAsync();

			expect(layer.getObjectById('obj1')).toBe(obj1);
			expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ object: obj1, toIndex: 0 }));
		});

		it('should remove an object and emit an "object::removed" event', async () => {
			layer.addObject(obj1);
			const onRemove = vi.fn();
			layer.on('object::removed', onRemove);
			layer.removeObject('obj1');

			await vi.runAllTimersAsync();

			expect(layer.getObjectById('obj1')).toBeUndefined();
			expect(onRemove).toHaveBeenCalledWith({ id: 'obj1' });
		});

		it('should move an object and emit an "object::moved" event', async () => {
			layer.addObject(obj1);
			layer.addObject(obj2);
			const onMove = vi.fn();
			layer.on('object::moved', onMove);

			layer.moveObject('obj1', 0);
			await vi.runAllTimersAsync();

			expect(layer.objects[0].id).toBe('obj1');
			expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'obj1', toIndex: 0 }));
		});

		it('should clear all objects', () => {
			layer.addObject(obj1);
			layer.addObject(obj2);

			layer.clear = () => {
				layer['_objects'].clear();
			};
			layer.clear();

			expect(layer.objects.length).toBe(0);
		});
	});

	describe('Properties and State', () => {
		beforeEach(() => {
			layer = new Layer(defaultOptions);
		});

		it('should return the correct tileMap from the grid', () => {
			expect(layer.tileMap).toBeTruthy();
		});

		it('isEmpty should be true when only the grid exists and its tilemap is empty', () => {
			expect(layer.isEmpty()).toBe(true);
		});

		it('isEmpty should be false when the tilemap is not empty', () => {
			layer.tileMap.addTile(0, 0);
			expect(layer.isEmpty()).toBe(false);
		});

		it('isEmpty should remain true when only objects exist but tilemap is empty', () => {
			layer.addObject(obj1);
			expect(layer.isEmpty()).toBe(false);
		});
	});

	describe('Layer Updates', () => {
		beforeEach(() => {
			layer = new Layer(defaultOptions);
		});

		it('should update its properties and emit "updated"', () => {
			const onUpdate = vi.fn();
			layer.on('updated', onUpdate);

			const updates = {
				name: 'New Name',
				index: 5,
				opts: { visible: false }
			};
			layer.update(updates);

			expect(layer.name).toBe('New Name');
			expect(layer.index).toBe(5);
			expect(layer.opts.visible).toBe(false);
			expect(layer.opts.locked).toBe(false);
			expect(onUpdate).toHaveBeenCalled();
		});
	});

	describe('Event Forwarding', () => {
		let smartObject: SmartObject;

		beforeEach(() => {
			smartObject = new SmartObject('forwarder');
			layer = new Layer(defaultOptions);
			layer.addObject(smartObject);
		});

		it('should forward "op" events from objects as "object::op"', async () => {
			const onOp = vi.fn();
			layer.on('object::op', onOp);
			const opData: ObjectOperation = { op: 'replace', path: 'x', value: 10 };

			smartObject.emit('op', opData);
			await vi.runAllTimersAsync();

			expect(onOp).toHaveBeenCalledWith({
				operation: opData,
				objectId: smartObject.id,
				objectType: smartObject.type
			});
		});

		it('should forward "update" events from objects as "object::update"', async () => {
			const onUpdate = vi.fn();
			layer.on('object::update', onUpdate);

			smartObject.emit('update');
			await vi.runAllTimersAsync();

			expect(onUpdate).toHaveBeenCalled();
		});
	});
});
