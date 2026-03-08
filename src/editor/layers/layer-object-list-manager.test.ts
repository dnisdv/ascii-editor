import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectListManager } from './layer-object-list-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';

describe('ObjectListManager', () => {
	let manager: ObjectListManager<MockSmartObject>;
	let obj1: MockSmartObject, obj2: MockSmartObject, obj3: MockSmartObject;

	beforeEach(() => {
		obj1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'obj1');
		obj2 = new MockSmartObject({ cellX: 1, cellY: 1, width: 1, height: 1 }, 'obj2');
		obj3 = new MockSmartObject({ cellX: 2, cellY: 2, width: 1, height: 1 }, 'obj3');
	});

	describe('Constructor and Initial State', () => {
		it('should initialize empty manager', () => {
			manager = new ObjectListManager();
			expect(manager.size).toBe(0);
			expect(manager.getAll()).toEqual([]);
		});

		it('should initialize with objects in order', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
			expect(manager.size).toBe(3);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should initialize with objects and existing orderKeys', () => {
			const orderKeys = {
				obj1: 'a0',
				obj2: 'a1',
				obj3: 'a2'
			};
			manager = new ObjectListManager([obj1, obj2, obj3], orderKeys);

			expect(manager.getOrderKey('obj1')).toBe('a0');
			expect(manager.getOrderKey('obj2')).toBe('a1');
			expect(manager.getOrderKey('obj3')).toBe('a2');
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should skip duplicate objects during initialization', () => {
			manager = new ObjectListManager([obj1, obj2, obj1, obj3]);
			expect(manager.size).toBe(3);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should call onAdd callback for each initial object', () => {
			const onAdd = vi.fn();
			manager = new ObjectListManager([obj1, obj2], undefined, { onAdd });

			expect(onAdd).toHaveBeenCalledTimes(2);
			expect(onAdd).toHaveBeenCalledWith(obj1, expect.any(Number));
			expect(onAdd).toHaveBeenCalledWith(obj2, expect.any(Number));
		});

		it('should call onChange once after bulk initialization', () => {
			const onChange = vi.fn();
			manager = new ObjectListManager([obj1, obj2, obj3], undefined, { onChange });

			expect(onChange).toHaveBeenCalledTimes(1);
		});
	});

	describe('Adding Objects', () => {
		beforeEach(() => {
			manager = new ObjectListManager();
		});

		it('should add object to empty list', () => {
			manager.add(obj1);
			expect(manager.size).toBe(1);
			expect(manager.has('obj1')).toBe(true);
			expect(manager.get('obj1')).toBe(obj1);
		});

		it('should add object at the top (start of list) by default', () => {
			manager.add(obj1);
			manager.add(obj2);
			manager.add(obj3);

			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj2', 'obj1']);
		});

		it('should place newer items before older when adding without position', () => {
			manager.add(obj1);

			manager.add(obj2);
			expect(manager.getIndexOf('obj2')).toBe(0);
			expect(manager.getIndexOf('obj1')).toBe(1);

			manager.add(obj3);
			expect(manager.getIndexOf('obj3')).toBe(0);
			expect(manager.getIndexOf('obj2')).toBe(1);
			expect(manager.getIndexOf('obj1')).toBe(2);

			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj2', 'obj1']);
		});

		it('should generate decreasing orderKeys for consecutive adds without position (newer first)', () => {
			manager.add(obj1);
			manager.add(obj2);
			manager.add(obj3);

			const k1 = manager.getOrderKey('obj1')!;
			const k2 = manager.getOrderKey('obj2')!;
			const k3 = manager.getOrderKey('obj3')!;

			expect(typeof k1).toBe('string');
			expect(typeof k2).toBe('string');
			expect(typeof k3).toBe('string');

			expect(k3 < k2).toBe(true);
			expect(k2 < k1).toBe(true);
		});

		it('should add object at specific numeric index', () => {
			manager.add(obj1, 0);
			manager.add(obj3, 1);
			manager.add(obj2, 1);

			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should add object with specific orderKey', () => {
			manager.add(obj1, { orderKey: 'a5' });

			expect(manager.getOrderKey('obj1')).toBe('a5');
		});

		it('should handle orderKey collision by placing new object after existing', () => {
			manager.add(obj1, { orderKey: 'a5' });
			manager.add(obj2, { orderKey: 'a5' });

			expect(manager.getOrderKey('obj1')).toBe('a5');
			expect(manager.getOrderKey('obj2')).not.toBe('a5');

			expect(manager.getIndexOf('obj2')).toBeGreaterThan(manager.getIndexOf('obj1'));
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2']);
		});

		it('should place new object after existing when collision with middle object', () => {
			manager.add(obj1, { orderKey: 'a1' });
			manager.add(obj2, { orderKey: 'a5' });
			manager.add(obj3, { orderKey: 'a9' });

			const obj4 = new MockSmartObject({ cellX: 3, cellY: 3, width: 1, height: 1 }, 'obj4');
			manager.add(obj4, { orderKey: 'a5' });

			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj4', 'obj3']);
			expect(manager.getIndexOf('obj2')).toBe(1);
			expect(manager.getIndexOf('obj4')).toBe(2);
		});

		it('should not add duplicate object', () => {
			manager.add(obj1);
			const initialSize = manager.size;

			manager.add(obj1);

			expect(manager.size).toBe(initialSize);
		});

		it('should call onAdd callback when adding object', () => {
			const onAdd = vi.fn();
			manager = new ObjectListManager([], undefined, { onAdd });
			manager.add(obj1, 0);

			expect(onAdd).toHaveBeenCalledWith(obj1, 0);
		});
	});

	describe('Removing Objects', () => {
		beforeEach(() => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
		});

		it('should remove object by id', () => {
			const removed = manager.remove('obj2');

			expect(removed).toBe(obj2);
			expect(manager.size).toBe(2);
			expect(manager.has('obj2')).toBe(false);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj3']);
		});

		it('should return undefined when removing non-existent object', () => {
			const removed = manager.remove('non-existent');

			expect(removed).toBeUndefined();
			expect(manager.size).toBe(3);
		});

		it('should call onRemove callback when removing object', () => {
			const onRemove = vi.fn();
			manager = new ObjectListManager([obj1, obj2], undefined, { onRemove });

			manager.remove('obj1');

			expect(onRemove).toHaveBeenCalledWith(obj1);
		});

		it('should call onChange callback when removing object', () => {
			const onChange = vi.fn();
			manager = new ObjectListManager([obj1, obj2], undefined, { onChange });

			manager.remove('obj1');

			expect(onChange).toHaveBeenCalled();
		});
	});

	describe('Reordering Objects', () => {
		beforeEach(() => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
		});

		it('should update object index (move to beginning)', () => {
			manager.updateIndex('obj3', 0);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj1', 'obj2']);
		});

		it('should update object index (move to end)', () => {
			manager.updateIndex('obj1', 2);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj3', 'obj1']);
		});

		it('should update object index (move to middle)', () => {
			const obj4 = new MockSmartObject({ cellX: 3, cellY: 3, width: 1, height: 1 }, 'obj4');
			manager.add(obj4, 3);

			manager.updateIndex('obj1', 2);

			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj3', 'obj1', 'obj4']);
		});

		it('should not change order if moving to same index', () => {
			const initialOrder = manager.getAll().map((o) => o.id);

			manager.updateIndex('obj2', 1);
			expect(manager.getAll().map((o) => o.id)).toEqual(initialOrder);
		});

		it('should warn when trying to reorder non-existent object', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			manager.updateIndex('non-existent', 0);

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
			consoleSpy.mockRestore();
		});

		it('should call onMove callback when reordering', () => {
			const onMove = vi.fn();
			manager = new ObjectListManager([obj1, obj2, obj3], undefined, { onMove });

			manager.updateIndex('obj3', 0);
			expect(onMove).toHaveBeenCalledWith('obj3', 0);
		});

		it('should call onChange callback when reordering', () => {
			const onChange = vi.fn();
			manager = new ObjectListManager([obj1, obj2, obj3], undefined, { onChange });

			manager.updateIndex('obj3', 0);

			expect(onChange).toHaveBeenCalled();
		});
	});

	describe('Querying Objects', () => {
		beforeEach(() => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
		});

		it('should get object by id', () => {
			expect(manager.get('obj2')).toBe(obj2);
		});

		it('should return undefined for non-existent object', () => {
			expect(manager.get('non-existent')).toBeUndefined();
		});

		it('should check if object exists', () => {
			expect(manager.has('obj2')).toBe(true);
			expect(manager.has('non-existent')).toBe(false);
		});

		it('should get orderKey for object', () => {
			const key = manager.getOrderKey('obj1');
			expect(key).toBeDefined();
			expect(typeof key).toBe('string');
		});

		it('should return undefined for orderKey of non-existent object', () => {
			expect(manager.getOrderKey('non-existent')).toBeUndefined();
		});

		it('should get index of object', () => {
			expect(manager.getIndexOf('obj1')).toBe(0);
			expect(manager.getIndexOf('obj2')).toBe(1);
			expect(manager.getIndexOf('obj3')).toBe(2);
		});

		it('should return -1 for index of non-existent object', () => {
			expect(manager.getIndexOf('non-existent')).toBe(-1);
		});

		it('should get all objects in order', () => {
			const all = manager.getAll();
			expect(all).toEqual([obj1, obj2, obj3]);
		});

		it('should return correct size', () => {
			expect(manager.size).toBe(3);

			manager.remove('obj2');
			expect(manager.size).toBe(2);

			const obj4 = new MockSmartObject({ cellX: 3, cellY: 3, width: 1, height: 1 });
			manager.add(obj4);
			expect(manager.size).toBe(3);
		});
	});

	describe('Clearing Objects', () => {
		beforeEach(() => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
		});

		it('should clear all objects', () => {
			manager.clear();

			expect(manager.size).toBe(0);
			expect(manager.getAll()).toEqual([]);
		});

		it('should clear objects conditionally with shouldKeep', () => {
			manager.clear((obj) => obj.id === 'obj2');

			expect(manager.size).toBe(1);
			expect(manager.get('obj2')).toBe(obj2);
			expect(manager.has('obj1')).toBe(false);
			expect(manager.has('obj3')).toBe(false);
		});

		it('should call onRemove for each cleared object', () => {
			const onRemove = vi.fn();
			manager = new ObjectListManager([obj1, obj2, obj3], undefined, { onRemove });

			manager.clear();

			expect(onRemove).toHaveBeenCalledTimes(3);
		});
	});

	describe('OrderKey Persistence (Undo/Redo Support)', () => {
		it('should maintain orderKeys across add/remove cycles', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
			const key2 = manager.getOrderKey('obj2');

			manager.remove('obj2');
			manager.add(obj2, { orderKey: key2 });

			expect(manager.getOrderKey('obj2')).toBe(key2);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should support undo by restoring original orderKey', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);

			const originalKeys = {
				obj1: manager.getOrderKey('obj1')!,
				obj2: manager.getOrderKey('obj2')!,
				obj3: manager.getOrderKey('obj3')!
			};

			manager.updateIndex('obj3', 0);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj1', 'obj2']);

			manager.remove('obj3');
			manager.add(obj3, { orderKey: originalKeys.obj3 });

			expect(manager.getOrderKey('obj3')).toBe(originalKeys.obj3);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should support redo by restoring moved orderKey', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);
			const originalKey = manager.getOrderKey('obj3')!;

			manager.updateIndex('obj3', 0);
			const movedKey = manager.getOrderKey('obj3')!;

			manager.remove('obj3');
			manager.add(obj3, { orderKey: originalKey });

			manager.remove('obj3');
			manager.add(obj3, { orderKey: movedKey });

			expect(manager.getOrderKey('obj3')).toBe(movedKey);
			expect(manager.getIndexOf('obj3')).toBe(0);
		});

		it('should handle complex undo/redo scenario with multiple operations', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);

			const state1 = {
				obj1: manager.getOrderKey('obj1')!,
				obj2: manager.getOrderKey('obj2')!,
				obj3: manager.getOrderKey('obj3')!
			};

			manager.updateIndex('obj1', 2);
			const state2 = {
				obj1: manager.getOrderKey('obj1')!,
				obj2: manager.getOrderKey('obj2')!,
				obj3: manager.getOrderKey('obj3')!
			};
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj3', 'obj1']);

			manager.updateIndex('obj3', 0);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj2', 'obj1']);

			manager.remove('obj1');
			manager.remove('obj2');
			manager.remove('obj3');
			manager.add(obj1, { orderKey: state2.obj1 });
			manager.add(obj2, { orderKey: state2.obj2 });
			manager.add(obj3, { orderKey: state2.obj3 });
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj3', 'obj1']);

			manager.remove('obj1');
			manager.remove('obj2');
			manager.remove('obj3');
			manager.add(obj1, { orderKey: state1.obj1 });
			manager.add(obj2, { orderKey: state1.obj2 });
			manager.add(obj3, { orderKey: state1.obj3 });
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
		});

		it('should restore from serialized orderKeys', () => {
			manager = new ObjectListManager([obj1, obj2, obj3]);

			const serialized = {
				obj1: manager.getOrderKey('obj1')!,
				obj2: manager.getOrderKey('obj2')!,
				obj3: manager.getOrderKey('obj3')!
			};

			const restoredManager = new ObjectListManager([obj1, obj2, obj3], serialized);

			expect(restoredManager.getAll().map((o) => o.id)).toEqual(['obj1', 'obj2', 'obj3']);
			expect(restoredManager.getOrderKey('obj1')).toBe(serialized.obj1);
			expect(restoredManager.getOrderKey('obj2')).toBe(serialized.obj2);
			expect(restoredManager.getOrderKey('obj3')).toBe(serialized.obj3);
		});
	});

	describe('Default Position Behavior - Objects Added Without Position Go to Bottom', () => {
		it('should add first object without position to index 0', () => {
			manager = new ObjectListManager();
			manager.add(obj1);

			expect(manager.getIndexOf('obj1')).toBe(0);
			expect(manager.getAll()).toEqual([obj1]);
		});

		it('should add second object without position to top (start of list)', () => {
			manager = new ObjectListManager();
			manager.add(obj1);
			manager.add(obj2);

			expect(manager.getIndexOf('obj2')).toBe(0);
			expect(manager.getIndexOf('obj1')).toBe(1);
			expect(manager.getAll()).toEqual([obj2, obj1]);
		});

		it('should place new objects on top while preserving existing relative order beneath', () => {
			manager = new ObjectListManager();

			manager.add(obj1);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj1']);

			manager.add(obj2);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj1']);

			manager.add(obj3);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj3', 'obj2', 'obj1']);
		});

		it('should maintain relative order when mixing positioned and non-positioned adds, with newest on top', () => {
			manager = new ObjectListManager();

			manager.add(obj1, 0);

			manager.add(obj2);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj1']);

			manager.add(obj3, 1);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj2', 'obj3', 'obj1']);

			const obj4 = new MockSmartObject({ cellX: 3, cellY: 3, width: 1, height: 1 }, 'obj4');
			manager.add(obj4);
			expect(manager.getAll().map((o) => o.id)).toEqual(['obj4', 'obj2', 'obj3', 'obj1']);
		});
	});
});
