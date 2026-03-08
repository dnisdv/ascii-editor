import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '@editor/history-manager';
import { objectSetProperty, SetPropertyHandler } from '@editor/objects/history/setProperty';
import {
	objectPropertiesPatch,
	ObjectPropertiesPatchHandler
} from '@editor/objects/history/object-properties-patch';
import {
	objectAnchorsPatch,
	ObjectAnchorsPatchHandler
} from '@editor/objects/history/object-anchors-patch';
import { BaseSmartObject } from '@editor/objects/smart-object.base';
import type { CellRectangle } from '@editor/types';
import type { ISmartObject, SmartObjectAnchor } from '@editor/objects/smart-object.interface';
import {
	beginBatch,
	cancelBatch,
	commitAllBatchFromVisual,
	commitAllFromVisual,
	commitAnchorsChange,
	commitBatch,
	commitFromVisual,
	commitProperties,
	moveAnchor,
	setAnchors,
	setProperty,
	setVisual,
	setVisualBatch
} from '@editor/objects/object-commands';

class TestRectObject extends BaseSmartObject {
	readonly type = 'test-rect';

	constructor(bounds: CellRectangle) {
		super(bounds, {
			capabilities: { canMove: true, canResize: true, canRotate: true, canSelect: true },
			properties: {}
		});
		const x = this.getCommittedProperty('transform.x') as number;
		const y = this.getCommittedProperty('transform.y') as number;
		const w = this.getCommittedProperty('transform.width') as number;
		const h = this.getCommittedProperty('transform.height') as number;
		this.anchors = [
			{ id: 'p0', x, y, type: 'geometric' },
			{ id: 'p1', x: x + w - 1, y: y + h - 1, type: 'geometric' }
		];
	}

	render(): void {
		/* not needed for tests */
	}
	clone(): ISmartObject {
		return new TestRectObject({
			cellX: this.getCommittedProperty('transform.x')!,
			cellY: this.getCommittedProperty('transform.y')!,
			width: this.getCommittedProperty('transform.width')!,
			height: this.getCommittedProperty('transform.height')!
		});
	}
	hitTest(cellX: number, cellY: number): boolean {
		const x = this.getCommittedProperty('transform.x') as number;
		const y = this.getCommittedProperty('transform.y') as number;
		const w = this.getCommittedProperty('transform.width') as number;
		const h = this.getCommittedProperty('transform.height') as number;
		return cellX >= x && cellX < x + w && cellY >= y && cellY < y + h;
	}
	regionHitTest(region: CellRectangle): boolean {
		const x = this.getCommittedProperty('transform.x') as number;
		const y = this.getCommittedProperty('transform.y') as number;
		const w = this.getCommittedProperty('transform.width') as number;
		const h = this.getCommittedProperty('transform.height') as number;
		return !(
			region.cellX + region.width <= x ||
			region.cellY + region.height <= y ||
			region.cellX >= x + w ||
			region.cellY >= y + h
		);
	}

	override getAnchors(): SmartObjectAnchor[] {
		return this.anchors;
	}
	override setAnchorsAbs(anchors: Array<{ x: number; y: number }>): void {
		if (anchors.length !== this.anchors.length) {
			this.anchors = anchors.map((a, i) => ({ id: `p${i}`, x: a.x, y: a.y, type: 'geometric' }));
		} else {
			this.anchors = this.anchors.map((old, i) => ({ ...old, x: anchors[i].x, y: anchors[i].y }));
		}
		this.emit('update');
	}
}

function makeHistoryWithHandlers() {
	const history = new HistoryManager();
	history.registerHandler(objectSetProperty, new SetPropertyHandler());
	history.registerHandler(objectPropertiesPatch, new ObjectPropertiesPatchHandler());
	history.registerHandler(objectAnchorsPatch, new ObjectAnchorsPatchHandler());
	return history;
}

function makeObject(
	history: HistoryManager,
	bounds: CellRectangle = { cellX: 1, cellY: 2, width: 3, height: 4 }
) {
	const obj = new TestRectObject(bounds);
	history.registerTarget(obj.id, obj);
	history.registerContext(obj.id, {});
	return obj;
}

describe('object-commands', () => {
	let history: HistoryManager;
	beforeEach(() => {
		history = makeHistoryWithHandlers();
	});

	describe('setProperty (single commit)', () => {
		it('updates committed value and supports undo/redo', () => {
			const obj = makeObject(history);
			const beforeX = obj.getCommittedProperty('transform.x');
			setProperty(history, obj, 'transform.x', (beforeX as number) + 5);

			expect(obj.getCommittedProperty('transform.x')).toBe((beforeX as number) + 5);

			history.undo();
			expect(obj.getCommittedProperty('transform.x')).toBe(beforeX);

			history.redo();
			expect(obj.getCommittedProperty('transform.x')).toBe((beforeX as number) + 5);
		});
	});

	describe('visual staging and commits', () => {
		it('setVisual only stages value; commitProperties persists via history with undo/redo', () => {
			const obj = makeObject(history);
			const beforeW = obj.getCommittedProperty('transform.width');
			setVisual(history, obj, 'transform.width', (beforeW as number) + 2);
			expect(obj.getProperty('transform.width')).toBe((beforeW as number) + 2);
			expect(obj.getCommittedProperty('transform.width')).toBe(beforeW);

			commitProperties(history, obj, [{ path: 'transform.width', after: (beforeW as number) + 2 }]);
			expect(obj.getCommittedProperty('transform.width')).toBe((beforeW as number) + 2);

			history.undo();
			expect(obj.getCommittedProperty('transform.width')).toBe(beforeW);

			history.redo();
			expect(obj.getCommittedProperty('transform.width')).toBe((beforeW as number) + 2);
		});

		it('commitFromVisual commits selected staged paths and discards them', () => {
			const obj = makeObject(history);
			const before = {
				x: obj.getCommittedProperty('transform.x') as number,
				y: obj.getCommittedProperty('transform.y') as number
			};
			setVisual(history, obj, 'transform.x', before.x + 1);
			setVisual(history, obj, 'transform.y', before.y + 2);
			commitFromVisual(history, obj, ['transform.x']);

			expect(obj.getCommittedProperty('transform.x')).toBe(before.x + 1);
			expect(obj.getCommittedProperty('transform.y')).toBe(before.y);
			expect(obj.getProperty('transform.y')).toBe(before.y + 2);

			history.undo();
			expect(obj.getCommittedProperty('transform.x')).toBe(before.x);
			expect(obj.getProperty('transform.y')).toBe(before.y + 2);
		});

		it('commitAllFromVisual commits all staged values and clears staging', () => {
			const obj = makeObject(history);
			setVisual(history, obj, 'transform.x', 100);
			setVisual(history, obj, 'transform.y', 200);

			commitAllFromVisual(history, obj);
			expect(obj.getCommittedProperty('transform.x')).toBe(100);
			expect(obj.getCommittedProperty('transform.y')).toBe(200);
			expect(obj.getPropertyManager().listVisualKeys().length).toBe(0);

			history.undo();
			expect(obj.getCommittedProperty('transform.x')).not.toBe(100);
			expect(obj.getCommittedProperty('transform.y')).not.toBe(200);

			history.redo();
			expect(obj.getCommittedProperty('transform.x')).toBe(100);
			expect(obj.getCommittedProperty('transform.y')).toBe(200);
		});
	});

	describe('batch visual commits (multiple objects in one entry)', () => {
		it('setVisualBatch stages multiple objects, commitAllBatchFromVisual commits in one history step with undo/redo affecting both', () => {
			const objA = makeObject(history, { cellX: 0, cellY: 0, width: 2, height: 2 });
			const objB = makeObject(history, { cellX: 10, cellY: 10, width: 3, height: 3 });

			setVisualBatch(
				history,
				[objA, objB],
				[
					{
						path: 'transform.x',
						value: (o: ISmartObject) => (o.getCommittedProperty('transform.x') as number) + 5
					},
					{
						path: 'transform.y',
						value: (o: ISmartObject) => (o.getCommittedProperty('transform.y') as number) + 7
					}
				]
			);

			const beforeLen = history.getHistory().length;
			commitAllBatchFromVisual(history, [objA, objB]);
			const afterLen = history.getHistory().length;
			expect(afterLen).toBe(beforeLen + 1);

			expect(objA.getCommittedProperty('transform.x')).toBe(0 + 5);
			expect(objA.getCommittedProperty('transform.y')).toBe(0 + 7);
			expect(objB.getCommittedProperty('transform.x')).toBe(10 + 5);
			expect(objB.getCommittedProperty('transform.y')).toBe(10 + 7);

			history.undo();
			expect(objA.getCommittedProperty('transform.x')).toBe(0);
			expect(objA.getCommittedProperty('transform.y')).toBe(0);
			expect(objB.getCommittedProperty('transform.x')).toBe(10);
			expect(objB.getCommittedProperty('transform.y')).toBe(10);

			history.redo();
			expect(objA.getCommittedProperty('transform.x')).toBe(5);
			expect(objA.getCommittedProperty('transform.y')).toBe(7);
			expect(objB.getCommittedProperty('transform.x')).toBe(15);
			expect(objB.getCommittedProperty('transform.y')).toBe(17);
		});

		it('beginBatch/commitBatch/apply multiple property patches into one composite entry', () => {
			const obj = makeObject(history);
			const batchId = beginBatch(history);

			const changes = [
				{ path: 'transform.x', after: 42 },
				{ path: 'transform.y', after: 24 }
			];
			const beforeSnapshot = changes.map((c) => ({
				path: c.path,
				before: obj.getCommittedProperty(c.path),
				after: obj.getCommittedProperty(c.path)
			}));
			const afterSnapshot = changes.map((c) => ({
				path: c.path,
				before: obj.getCommittedProperty(c.path),
				after: c.after
			}));
			const action = {
				type: objectPropertiesPatch.type,
				targetId: obj.id,
				before: { changes: beforeSnapshot },
				after: { changes: afterSnapshot }
			} as const;

			const beforeLen = history.getHistory().length;
			history.applyAction(action, { batchId });
			commitBatch(history, batchId);
			const afterLen = history.getHistory().length;
			expect(afterLen).toBe(beforeLen + 1);

			expect(obj.getCommittedProperty('transform.x')).toBe(42);
			expect(obj.getCommittedProperty('transform.y')).toBe(24);

			history.undo();
			expect(obj.getCommittedProperty('transform.x')).not.toBe(42);
			expect(obj.getCommittedProperty('transform.y')).not.toBe(24);

			history.redo();
			expect(obj.getCommittedProperty('transform.x')).toBe(42);
			expect(obj.getCommittedProperty('transform.y')).toBe(24);
		});

		it('cancelBatch drops queued actions (commit after cancel throws and applies nothing)', () => {
			const obj = makeObject(history);
			const bid = beginBatch(history);

			const action = {
				type: objectPropertiesPatch.type,
				targetId: obj.id,
				before: {
					changes: [
						{
							path: 'transform.x',
							before: obj.getCommittedProperty('transform.x'),
							after: obj.getCommittedProperty('transform.x')
						}
					]
				},
				after: {
					changes: [
						{ path: 'transform.x', before: obj.getCommittedProperty('transform.x'), after: 11 }
					]
				}
			} as const;

			history.applyAction(action, { batchId: bid });
			cancelBatch(history, bid);

			const lenBefore = history.getHistory().length;
			expect(() => commitBatch(history, bid)).toThrowError();
			expect(history.getHistory().length).toBe(lenBefore);
			expect(obj.getCommittedProperty('transform.x')).not.toBe(11);
		});
	});

	describe('anchors commands', () => {
		it('moveAnchor updates a single anchor with undo/redo', () => {
			const obj = makeObject(history, { cellX: 5, cellY: 6, width: 3, height: 3 });
			const before = (obj.getAnchors?.() || []).map((a) => ({ id: a.id, x: a.x, y: a.y }));
			const target = before[0];

			moveAnchor(history, obj, target.id, target.x + 4, target.y + 2);

			const afterMove = obj.getAnchors?.() || [];
			expect(afterMove.find((a) => a.id === target.id)!.x).toBe(target.x + 4);
			expect(afterMove.find((a) => a.id === target.id)!.y).toBe(target.y + 2);

			history.undo();
			const afterUndo = obj.getAnchors?.() || [];
			expect(afterUndo.find((a) => a.id === target.id)!.x).toBe(target.x);
			expect(afterUndo.find((a) => a.id === target.id)!.y).toBe(target.y);

			history.redo();
			const afterRedo = obj.getAnchors?.() || [];
			expect(afterRedo.find((a) => a.id === target.id)!.x).toBe(target.x + 4);
			expect(afterRedo.find((a) => a.id === target.id)!.y).toBe(target.y + 2);
		});

		it('setAnchors replaces full anchor layout with undo/redo', () => {
			const obj = makeObject(history, { cellX: 0, cellY: 0, width: 2, height: 2 });
			const newAnchors = [
				{ x: 10, y: 10 },
				{ x: 20, y: 20 },
				{ x: 30, y: 30 }
			];

			setAnchors(history, obj, newAnchors);
			expect((obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }))).toEqual(newAnchors);

			history.undo();
			const afterUndo = (obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }));
			expect(afterUndo).not.toEqual(newAnchors);

			history.redo();
			expect((obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }))).toEqual(newAnchors);
		});

		it('commitAnchorsChange records explicit before/after snapshots for an already-mutated object and supports full undo/redo cycles', () => {
			const obj = makeObject(history, { cellX: 1, cellY: 1, width: 2, height: 2 });
			const before = (obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }));
			const after = before.map((p) => ({ x: p.x + 5, y: p.y + 7 }));

			obj.setAnchorsAbs(after);

			commitAnchorsChange(history, obj, before, after);
			expect((obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }))).toEqual(after);

			for (let i = 0; i < 2; i++) {
				history.undo();
				expect((obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }))).toEqual(before);
				history.redo();
				expect((obj.getAnchors?.() || []).map((a) => ({ x: a.x, y: a.y }))).toEqual(after);
			}
		});
	});
});
