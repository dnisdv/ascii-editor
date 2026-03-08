import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '@editor/history-manager';
import { LineObject } from '@editor/tools/shape/line-object';
import {
	objectAnchorsPatch,
	ObjectAnchorsPatchHandler,
	type ObjectAnchorsPatchAction
} from './object-anchors-patch';

function cloneAnchors(anchors: Array<{ x: number; y: number }>) {
	return anchors.map((a) => ({ x: a.x, y: a.y }));
}

describe('object::anchors_patch history', () => {
	let history: HistoryManager;
	let line: LineObject;

	beforeEach(() => {
		history = new HistoryManager();
		history.registerHandler(objectAnchorsPatch, new ObjectAnchorsPatchHandler());
		line = new LineObject({ cellX: 10, cellY: 10, width: 5, height: 1 });
		history.registerTarget(line.id, line);
		history.registerContext(line.id, {});
	});

	it('execute(): applies new anchors and records undo/redo', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const afterAbs = cloneAnchors(beforeAbs);
		afterAbs[0] = { x: beforeAbs[0].x + 2, y: beforeAbs[0].y };

		history.execute(objectAnchorsPatch, line.id, { anchors: afterAbs });

		const applied = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		expect(applied).toEqual(afterAbs);

		history.undo();
		const undone = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		expect(undone).toEqual(beforeAbs);

		history.redo();
		const redone = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		expect(redone).toEqual(afterAbs);
	});

	it('applyAction(false): records completed drag without reapplying (behavioral)', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		const lastAnchor = line.getAnchors().at(-1)!;
		line.moveAnchor(lastAnchor.id, lastAnchor.x, lastAnchor.y + 3);

		const afterAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: beforeAbs },
				after: { anchors: afterAbs }
			},
			{ applyAction: false }
		);

		history.undo();
		const undone = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		expect(undone).toEqual(beforeAbs);

		history.redo();
		const redone = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		expect(redone).toEqual(afterAbs);
	});

	it('integration: moveAnchor then history undo/redo changes anchors and bounds (behavioral)', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const beforeBounds = {
			x: line.getProperty('transform.x'),
			y: line.getProperty('transform.y'),
			w: line.getProperty('transform.width'),
			h: line.getProperty('transform.height')
		};

		const firstId = line.getAnchors()[0].id;
		const newPos = { x: beforeAbs[0].x + 2, y: beforeAbs[0].y + 1 };
		line.moveAnchor(firstId, newPos.x, newPos.y);

		const afterAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const afterBounds = {
			x: line.getProperty('transform.x'),
			y: line.getProperty('transform.y'),
			w: line.getProperty('transform.width'),
			h: line.getProperty('transform.height')
		};

		expect(afterAbs).not.toEqual(beforeAbs);

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: beforeAbs },
				after: { anchors: afterAbs }
			},
			{ applyAction: false }
		);

		history.undo();
		const undoneAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const undoneBounds = {
			x: line.getProperty('transform.x'),
			y: line.getProperty('transform.y'),
			w: line.getProperty('transform.width'),
			h: line.getProperty('transform.height')
		};
		expect(undoneAbs).toEqual(beforeAbs);
		expect(undoneBounds).toEqual(beforeBounds);

		history.redo();
		const redoneAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const redoneBounds = {
			x: line.getProperty('transform.x'),
			y: line.getProperty('transform.y'),
			w: line.getProperty('transform.width'),
			h: line.getProperty('transform.height')
		};
		expect(redoneAbs).toEqual(afterAbs);
		expect(redoneBounds).toEqual(afterBounds);
	});

	it('execute(): multiple anchors moved and undo/redo restores correctly (deep copies)', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		const afterAbs = cloneAnchors(beforeAbs);
		afterAbs[0] = { x: beforeAbs[0].x + 1, y: beforeAbs[0].y + 2 };
		afterAbs[afterAbs.length - 1] = {
			x: beforeAbs[afterAbs.length - 1].x - 2,
			y: beforeAbs[afterAbs.length - 1].y - 1
		};

		history.execute(objectAnchorsPatch, line.id, { anchors: afterAbs });

		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(afterAbs);

		const lastAction = history.getHistory().at(-1) as ObjectAnchorsPatchAction;
		expect(lastAction.before.anchors).toEqual(beforeAbs);
		expect(lastAction.after.anchors).toEqual(afterAbs);

		history.undo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(beforeAbs);

		history.redo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(afterAbs);
	});

	it('applyAction(false): multiple interactive anchor moves recorded and undo/redo works (deep copies)', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		const anchors = line.getAnchors();
		if (anchors.length >= 3) {
			line.moveAnchor(anchors[1].id, anchors[1].x + 2, anchors[1].y);
			line.moveAnchor(anchors[2].id, anchors[2].x, anchors[2].y + 1);
		} else if (anchors.length >= 2) {
			line.moveAnchor(anchors[0].id, anchors[0].x + 2, anchors[0].y);
			line.moveAnchor(anchors[1].id, anchors[1].x, anchors[1].y + 1);
		}

		const afterAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: beforeAbs },
				after: { anchors: afterAbs }
			},
			{ applyAction: false }
		);

		const lastAction = history.getHistory().at(-1) as ObjectAnchorsPatchAction;
		expect(lastAction.before.anchors).toEqual(beforeAbs);
		expect(lastAction.after.anchors).toEqual(afterAbs);

		history.undo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(beforeAbs);

		history.redo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(afterAbs);
	});

	it('applyAction(false): moving a visual anchor promotes it and inserts new visuals; undo/redo restores', () => {
		const beforeAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const beforeLen = line.getAnchors().length;
		expect(beforeLen).toBeGreaterThanOrEqual(3);

		const visuals = line.getAnchors().filter((a) => a.type === 'visual');
		expect(visuals.length).toBeGreaterThan(0);
		const v = visuals[0];

		line.moveAnchor(v.id, v.x + 2, v.y + 1);

		const afterAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const afterLen = line.getAnchors().length;
		expect(afterLen).toBeGreaterThan(beforeLen);
		expect(afterAbs).not.toEqual(beforeAbs);

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: beforeAbs },
				after: { anchors: afterAbs }
			},
			{ applyAction: false }
		);

		history.undo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(beforeAbs);
		expect(line.getAnchors().length).toBe(beforeLen);

		history.redo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(afterAbs);
		expect(line.getAnchors().length).toBe(afterLen);
	});

	it('applyAction(false): multiple visual promotions accumulate and fully undo/redo across the stack', () => {
		const startAbs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const startLen = line.getAnchors().length;

		const v1 = line.getAnchors().find((a) => a.type === 'visual');
		expect(v1).toBeTruthy();
		line.moveAnchor(v1!.id, v1!.x + 1, v1!.y);
		const after1Abs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const after1Len = line.getAnchors().length;
		expect(after1Len).toBeGreaterThan(startLen);

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: startAbs },
				after: { anchors: after1Abs }
			},
			{ applyAction: false }
		);

		const v2 = line.getAnchors().find((a) => a.type === 'visual');
		expect(v2).toBeTruthy();
		line.moveAnchor(v2!.id, v2!.x, v2!.y + 1);
		const after2Abs = line.getAnchors().map((a) => ({ x: a.x, y: a.y }));
		const after2Len = line.getAnchors().length;
		expect(after2Len).toBeGreaterThan(after1Len);

		history.applyAction(
			{
				type: objectAnchorsPatch.type,
				targetId: line.id,
				before: { anchors: after1Abs },
				after: { anchors: after2Abs }
			},
			{ applyAction: false }
		);

		expect(history.getHistory().length).toBe(2);

		history.undo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(after1Abs);
		expect(line.getAnchors().length).toBe(after1Len);

		history.undo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(startAbs);
		expect(line.getAnchors().length).toBe(startLen);

		history.redo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(after1Abs);
		expect(line.getAnchors().length).toBe(after1Len);

		history.redo();
		expect(line.getAnchors().map((a) => ({ x: a.x, y: a.y }))).toEqual(after2Abs);
		expect(line.getAnchors().length).toBe(after2Len);
	});
});
