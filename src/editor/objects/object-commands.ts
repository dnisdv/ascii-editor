import type { HistoryManager } from '@editor/history-manager';
import type { ISmartObject } from './smart-object.interface';
import { objectSetProperty } from './history/setProperty';
import { objectPropertiesPatch, type PropertyChange } from './history/object-properties-patch';
import { objectAnchorsPatch } from '@editor/objects/history/object-anchors-patch';
import type { SmartObjectAnchor } from './smart-object.interface';

function collectVisualChanges(obj: ISmartObject, paths?: string[]): PropertyChange[] {
	const pm = obj.properties;
	const keys = paths?.length ? paths : pm.listVisualKeys();
	if (!keys.length) return [];
	return keys
		.map((path) => ({ path, after: pm.getVisual(path) }))
		.filter((c): c is { path: string; after: unknown } => c.after !== undefined)
		.map((c) => ({ path: c.path, before: obj.getCommittedProperty(c.path), after: c.after }));
}

function ensureRegistered(history: HistoryManager, obj: ISmartObject): void {
	const targets: Map<string, unknown> | undefined = (
		history as unknown as { targets: Map<string, unknown> }
	).targets;
	const isRegistered = targets?.has(obj.id);
	if (isRegistered) return;
	try {
		history.registerTarget(obj.id, obj);
		history.registerContext(obj.id, {});
	} catch {
		void 0;
	}
}

function createPatchAction(obj: ISmartObject, changes: PropertyChange[]) {
	const beforeChanges = JSON.parse(
		JSON.stringify(changes.map((c) => ({ path: c.path, before: c.before, after: c.before })))
	);
	const afterChanges = JSON.parse(
		JSON.stringify(changes.map((c) => ({ path: c.path, before: c.before, after: c.after })))
	);
	return {
		type: objectPropertiesPatch.type,
		targetId: obj.id,
		before: { changes: beforeChanges },
		after: { changes: afterChanges }
	} as const;
}

export function beginBatch(history: HistoryManager): string {
	return history.beginBatch();
}

export function commitBatch(history: HistoryManager, id: string): void {
	history.commitBatch(id);
}

export function cancelBatch(history: HistoryManager, id: string): void {
	history.cancelBatch(id);
}

export function setProperty(
	history: HistoryManager,
	obj: ISmartObject,
	path: string,
	value: unknown
): void {
	const before = obj.getCommittedProperty(path);
	if (before === value) return;
	history.execute(objectSetProperty, obj.id, { path, value });
}

export function commitProperties(
	history: HistoryManager,
	obj: ISmartObject,
	changes: Array<{ path: string; after: unknown }>
): void {
	if (!changes.length) return;
	const payload: PropertyChange[] = changes.map((c) => ({
		path: c.path,
		before: obj.getCommittedProperty(c.path),
		after: c.after
	}));
	history.execute(objectPropertiesPatch, obj.id, { changes: payload });
}

export function setVisual(
	_history: HistoryManager,
	obj: ISmartObject,
	path: string,
	value: unknown
): void {
	obj.setPropertyVisual(path, value);
}

export function commitFromVisual(
	history: HistoryManager,
	obj: ISmartObject,
	paths: string[]
): void {
	if (!paths.length) return;
	const changes = collectVisualChanges(obj, paths).map(({ path, after }) => ({ path, after }));
	commitProperties(history, obj, changes);

	obj.discardProperties(paths);
}

export function commitAllFromVisual(history: HistoryManager, obj: ISmartObject): void {
	const changes = collectVisualChanges(obj).map(({ path, after }) => ({ path, after }));
	if (!changes.length) return;
	commitProperties(history, obj, changes);
	obj.discardProperties();
}

export function setVisualBatch(
	_history: HistoryManager,
	objects: ISmartObject[],
	updates: Array<{ path: string; value: unknown | ((obj: ISmartObject) => unknown) }>
): void {
	objects.forEach((obj) => {
		updates.forEach(({ path, value }) => {
			const computedValue =
				typeof value === 'function' ? (value as (obj: ISmartObject) => unknown)(obj) : value;
			obj.setPropertyVisual(path, computedValue);
		});
	});
}

export function commitAllBatchFromVisual(history: HistoryManager, objects: ISmartObject[]): void {
	if (!objects.length) return;

	const objectChanges: Array<{ obj: ISmartObject; changes: PropertyChange[] }> = [];
	for (const obj of objects) {
		const changes = collectVisualChanges(obj);
		if (changes.length > 0) objectChanges.push({ obj, changes });
	}

	if (objectChanges.length === 0) return;

	const batchId = history.beginBatch();
	try {
		for (const { obj, changes } of objectChanges) {
			ensureRegistered(history, obj);
			const action = createPatchAction(obj, changes);
			history.applyAction(action, { batchId });
		}

		history.commitBatch(batchId);
	} catch (e) {
		history.cancelBatch(batchId);
		throw e;
	}

	for (const { obj } of objectChanges) obj.discardProperties();
}

export function moveAnchor(
	history: HistoryManager,
	obj: ISmartObject,
	anchorId: string,
	toCellX: number,
	toCellY: number
): void {
	const beforeAnchors = obj.getAnchors
		? obj.getAnchors().map((a: SmartObjectAnchor) => ({ id: a.id, x: a.x, y: a.y }))
		: [];
	if (!beforeAnchors.length) return;

	const afterAnchorsXY = beforeAnchors.map((a: { id: string; x: number; y: number }) =>
		a.id === anchorId ? { x: toCellX, y: toCellY } : { x: a.x, y: a.y }
	);

	const changed = afterAnchorsXY.some(
		(p: { x: number; y: number }, i: number) =>
			p.x !== beforeAnchors[i].x || p.y !== beforeAnchors[i].y
	);
	if (!changed) return;

	history.execute(objectAnchorsPatch, obj.id, {
		anchors: afterAnchorsXY,
		before: beforeAnchors.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }))
	});
}

export function setAnchors(
	history: HistoryManager,
	obj: ISmartObject,
	anchors: Array<{ x: number; y: number }>
): void {
	const before = obj.getAnchors
		? obj.getAnchors().map((a: SmartObjectAnchor) => ({ x: a.x, y: a.y }))
		: [];
	if (
		before.length === anchors.length &&
		anchors.every(
			(p: { x: number; y: number }, i: number) => p.x === before[i].x && p.y === before[i].y
		)
	)
		return;

	history.execute(objectAnchorsPatch, obj.id, { anchors, before });
}

export function commitAnchorsChange(
	history: HistoryManager,
	obj: ISmartObject,
	before: Array<{ x: number; y: number }>,
	after: Array<{ x: number; y: number }>
): void {
	if (
		before.length === after.length &&
		after.every(
			(p: { x: number; y: number }, i: number) => p.x === before[i].x && p.y === before[i].y
		)
	)
		return;
	history.execute(objectAnchorsPatch, obj.id, { anchors: after, before });
}

export const getObjectSizes = (obj: ISmartObject) => {
	const cellX = obj.getProperty('transform.x');
	const cellY = obj.getProperty('transform.y');
	const width = obj.getProperty('transform.width');
	const height = obj.getProperty('transform.height');

	return { cellX, cellY, width, height };
};

export function setObjectName(history: HistoryManager, obj: ISmartObject, name: string): void {
	ensureRegistered(history, obj);
	setProperty(history, obj, 'meta.name', name);
}
