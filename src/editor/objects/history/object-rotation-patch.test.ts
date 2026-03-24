import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '@editor/history-manager';
import {
	objectRotationPatch,
	ObjectRotationPatchHandler,
	type ObjectRotationPatchAction,
	type RotationState
} from './object-rotation-patch';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';
import { LineObject } from '@editor/tools/shape/line-object';

function setupHistory(historyManager: HistoryManager, obj: { id: string }) {
	historyManager.registerHandler(objectRotationPatch, new ObjectRotationPatchHandler());
	historyManager.registerTarget(obj.id, obj);
	historyManager.registerContext(obj.id, {});
}

function captureRectState(rect: RectangleObject): RotationState {
	return {
		x: rect.getCommittedProperty<number>('transform.x'),
		y: rect.getCommittedProperty<number>('transform.y'),
		width: rect.getCommittedProperty<number>('transform.width'),
		height: rect.getCommittedProperty<number>('transform.height')
	};
}

function captureLineState(line: LineObject): RotationState {
	return {
		x: line.getCommittedProperty<number>('transform.x'),
		y: line.getCommittedProperty<number>('transform.y'),
		width: line.getCommittedProperty<number>('transform.width'),
		height: line.getCommittedProperty<number>('transform.height'),
		content: line.getRotationContent()
	};
}

function recordRotation(
	historyManager: HistoryManager,
	obj: RectangleObject | LineObject,
	before: RotationState,
	after: RotationState
) {
	const action: ObjectRotationPatchAction = {
		type: objectRotationPatch.type,
		targetId: obj.id,
		before,
		after
	};
	historyManager.applyAction(action, { applyAction: false });
}

describe('ObjectRotationPatchHandler — history', () => {
	let historyManager: HistoryManager;

	beforeEach(() => {
		historyManager = new HistoryManager();
	});

	describe('RectangleObject', () => {
		let rect: RectangleObject;

		beforeEach(() => {
			rect = new RectangleObject({ cellX: 5, cellY: 5, width: 4, height: 6 });
			setupHistory(historyManager, rect);
		});

		it('undo restores original position and dimensions', () => {
			const before = captureRectState(rect);
			rect.applyRotation(90);
			const after = captureRectState(rect);

			recordRotation(historyManager, rect, before, after);
			historyManager.undo();

			expect(rect.getProperty('transform.x')).toBe(before.x);
			expect(rect.getProperty('transform.y')).toBe(before.y);
			expect(rect.getProperty('transform.width')).toBe(before.width);
			expect(rect.getProperty('transform.height')).toBe(before.height);
		});

		it('redo reapplies rotation after undo', () => {
			const before = captureRectState(rect);
			rect.applyRotation(90);
			const after = captureRectState(rect);

			recordRotation(historyManager, rect, before, after);
			historyManager.undo();
			historyManager.redo();

			expect(rect.getProperty('transform.x')).toBe(after.x);
			expect(rect.getProperty('transform.y')).toBe(after.y);
			expect(rect.getProperty('transform.width')).toBe(after.width);
			expect(rect.getProperty('transform.height')).toBe(after.height);
		});

		it('undo of 180° rotation restores state', () => {
			const before = captureRectState(rect);
			rect.applyRotation(180);
			const after = captureRectState(rect);

			recordRotation(historyManager, rect, before, after);
			historyManager.undo();

			expect(rect.getProperty('transform.x')).toBe(before.x);
			expect(rect.getProperty('transform.y')).toBe(before.y);
		});

		it('multiple rotations: each undo steps back one rotation', () => {
			const state0 = captureRectState(rect);

			rect.applyRotation(90);
			const state1 = captureRectState(rect);
			recordRotation(historyManager, rect, state0, state1);

			rect.applyRotation(90);
			const state2 = captureRectState(rect);
			recordRotation(historyManager, rect, state1, state2);

			historyManager.undo();
			expect(rect.getProperty('transform.x')).toBe(state1.x);
			expect(rect.getProperty('transform.width')).toBe(state1.width);

			historyManager.undo();
			expect(rect.getProperty('transform.x')).toBe(state0.x);
			expect(rect.getProperty('transform.width')).toBe(state0.width);
		});

		it('redo after multiple undos reapplies in order', () => {
			const state0 = captureRectState(rect);

			rect.applyRotation(90);
			const state1 = captureRectState(rect);
			recordRotation(historyManager, rect, state0, state1);

			rect.applyRotation(90);
			const state2 = captureRectState(rect);
			recordRotation(historyManager, rect, state1, state2);

			historyManager.undo();
			historyManager.undo();
			historyManager.redo();

			expect(rect.getProperty('transform.x')).toBe(state1.x);
			expect(rect.getProperty('transform.width')).toBe(state1.width);

			historyManager.redo();
			expect(rect.getProperty('transform.x')).toBe(state2.x);
			expect(rect.getProperty('transform.width')).toBe(state2.width);
		});

		it('undo does nothing when history is empty', () => {
			const x = rect.getProperty('transform.x');
			historyManager.undo();
			expect(rect.getProperty('transform.x')).toBe(x);
		});

		it('new rotation after undo discards redoable future', () => {
			const state0 = captureRectState(rect);

			rect.applyRotation(90);
			const state1 = captureRectState(rect);
			recordRotation(historyManager, rect, state0, state1);

			historyManager.undo();

			rect.applyRotation(180);
			const state2 = captureRectState(rect);
			recordRotation(historyManager, rect, state0, state2);

			historyManager.undo();
			historyManager.redo();

			expect(rect.getProperty('transform.width')).toBe(state2.width);
			expect(rect.getProperty('transform.height')).toBe(state2.height);
		});
	});

	describe('LineObject — content capture in history', () => {
		let line: LineObject;

		beforeEach(() => {
			line = new LineObject({ cellX: 0, cellY: 0, width: 5, height: 1 });
			setupHistory(historyManager, line);
		});

		it('undo restores anchor content (line shape) after rotation', () => {
			const before = captureLineState(line);
			line.applyRotation(90);
			const after = captureLineState(line);

			recordRotation(historyManager, line, before, after);
			historyManager.undo();

			expect(line.getRotationContent()).toBe(before.content);
		});

		it('redo restores rotated anchor content after undo', () => {
			const before = captureLineState(line);
			line.applyRotation(90);
			const after = captureLineState(line);

			recordRotation(historyManager, line, before, after);
			historyManager.undo();
			historyManager.redo();

			expect(line.getRotationContent()).toBe(after.content);
		});

		it('undo restores bounding box dimensions for line', () => {
			const before = captureLineState(line);
			line.applyRotation(90);
			const after = captureLineState(line);

			recordRotation(historyManager, line, before, after);
			historyManager.undo();

			expect(line.getProperty('transform.width')).toBe(before.width);
			expect(line.getProperty('transform.height')).toBe(before.height);
		});

		it('two 90° rotations: two undos restore original line', () => {
			const state0 = captureLineState(line);

			line.applyRotation(90);
			const state1 = captureLineState(line);
			recordRotation(historyManager, line, state0, state1);

			line.applyRotation(90);
			const state2 = captureLineState(line);
			recordRotation(historyManager, line, state1, state2);

			historyManager.undo();
			historyManager.undo();

			expect(line.getRotationContent()).toBe(state0.content);
			expect(line.getProperty('transform.width')).toBe(state0.width);
			expect(line.getProperty('transform.height')).toBe(state0.height);
		});
	});
});
