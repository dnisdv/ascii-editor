import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '@editor/history-manager';
import { LineObject } from '@editor/tools/shape/line-object';
import {
	objectAnchorsPatch,
	ObjectAnchorsPatchHandler
} from '@editor/objects/history/object-anchors-patch';
import { moveAnchor, setAnchors, commitAnchorsChange } from './object-commands';

function anchorsXY(obj: LineObject) {
	return obj.getAnchors().map((a) => ({ x: a.x, y: a.y }));
}

describe('object-commands: anchors', () => {
	let history: HistoryManager;
	let line: LineObject;

	beforeEach(() => {
		history = new HistoryManager();
		history.registerHandler(objectAnchorsPatch, new ObjectAnchorsPatchHandler());
		line = new LineObject({ cellX: 10, cellY: 10, width: 5, height: 1 });
		history.registerTarget(line.id, line);
		history.registerContext(line.id, {});
	});

	it('moveAnchor executes via history and supports undo/redo', () => {
		const before = anchorsXY(line);
		const first = line.getAnchors()[0];

		moveAnchor(history, line, first.id, first.x + 2, first.y + 1);

		const after = anchorsXY(line);
		expect(after).not.toEqual(before);

		expect(history.getHistory().length).toBe(1);

		history.undo();
		expect(anchorsXY(line)).toEqual(before);

		history.redo();
		expect(anchorsXY(line)).toEqual(after);
	});

	it('moveAnchor is a no-op when coordinates do not change', () => {
		const before = anchorsXY(line);
		const first = line.getAnchors()[0];
		const stackLen = history.getHistory().length;

		moveAnchor(history, line, first.id, first.x, first.y);

		expect(anchorsXY(line)).toEqual(before);
		expect(history.getHistory().length).toBe(stackLen);
	});

	it('moveAnchor with unknown id is a no-op and does not push history', () => {
		const before = anchorsXY(line);
		const stackLen = history.getHistory().length;

		moveAnchor(history, line, 'unknown-anchor-id', before[0].x + 1, before[0].y + 1);

		expect(anchorsXY(line)).toEqual(before);
		expect(history.getHistory().length).toBe(stackLen);
	});

	it('setAnchors applies bulk anchors and supports undo/redo; no-op if same', () => {
		const before = anchorsXY(line);

		const next = before.map((p, i) => {
			if (i === 0) return { x: p.x + 1, y: p.y };
			if (i === before.length - 1) return { x: p.x, y: p.y + 1 };
			return p;
		});

		setAnchors(history, line, next);

		expect(anchorsXY(line)).toEqual(next);
		const stackAfterSet = history.getHistory().length;

		setAnchors(history, line, next);
		expect(history.getHistory().length).toBe(stackAfterSet);

		history.undo();
		expect(anchorsXY(line)).toEqual(before);

		history.redo();
		expect(anchorsXY(line)).toEqual(next);
	});

	it('sequence: two moves create two entries; undo/redo walks correctly', () => {
		const start = anchorsXY(line);

		const first = line.getAnchors()[0];
		moveAnchor(history, line, first.id, first.x + 1, first.y);
		const mid = anchorsXY(line);

		const last = line.getAnchors().at(-1)!;
		moveAnchor(history, line, last.id, last.x, last.y + 2);
		const end = anchorsXY(line);

		expect(history.getHistory().length).toBe(2);

		history.undo();
		expect(anchorsXY(line)).toEqual(mid);

		history.undo();
		expect(anchorsXY(line)).toEqual(start);

		history.redo();
		expect(anchorsXY(line)).toEqual(mid);

		history.redo();
		expect(anchorsXY(line)).toEqual(end);
	});

	it('commitAnchorsChange: moving a visual anchor (interactive) then recording supports undo/redo', () => {
		const before = anchorsXY(line);
		const beforeLen = line.getAnchors().length;

		const v = line.getAnchors().find((a) => a.type === 'visual');
		expect(v).toBeTruthy();
		line.moveAnchor(v!.id, v!.x + 1, v!.y + 1);

		const after = anchorsXY(line);
		const afterLen = line.getAnchors().length;
		expect(after).not.toEqual(before);
		expect(afterLen).toBeGreaterThan(beforeLen);

		commitAnchorsChange(history, line, before, after);
		expect(history.getHistory().length).toBe(1);

		history.undo();
		expect(anchorsXY(line)).toEqual(before);
		expect(line.getAnchors().length).toBe(beforeLen);

		history.redo();
		expect(anchorsXY(line)).toEqual(after);
		expect(line.getAnchors().length).toBe(afterLen);
	});

	it('commitAnchorsChange: two visual promotions create two entries; full undo/redo across stack', () => {
		const start = anchorsXY(line);
		const startLen = line.getAnchors().length;

		const v1 = line.getAnchors().find((a) => a.type === 'visual');
		expect(v1).toBeTruthy();
		line.moveAnchor(v1!.id, v1!.x + 1, v1!.y);
		const after1 = anchorsXY(line);
		const after1Len = line.getAnchors().length;
		expect(after1Len).toBeGreaterThan(startLen);
		commitAnchorsChange(history, line, start, after1);

		const v2 = line.getAnchors().find((a) => a.type === 'visual');
		expect(v2).toBeTruthy();
		line.moveAnchor(v2!.id, v2!.x, v2!.y + 1);
		const after2 = anchorsXY(line);
		const after2Len = line.getAnchors().length;
		expect(after2Len).toBeGreaterThan(after1Len);
		commitAnchorsChange(history, line, after1, after2);

		expect(history.getHistory().length).toBe(2);

		history.undo();
		expect(anchorsXY(line)).toEqual(after1);
		expect(line.getAnchors().length).toBe(after1Len);

		history.undo();
		expect(anchorsXY(line)).toEqual(start);
		expect(line.getAnchors().length).toBe(startLen);

		history.redo();
		expect(anchorsXY(line)).toEqual(after1);
		expect(line.getAnchors().length).toBe(after1Len);

		history.redo();
		expect(anchorsXY(line)).toEqual(after2);
		expect(line.getAnchors().length).toBe(after2Len);
	});
});
