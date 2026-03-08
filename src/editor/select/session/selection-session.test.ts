import { describe, beforeEach, vi, it, expect } from 'vitest';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { SelectionSession } from './selection-session';
import { MockSmartObject } from '@editor/__mock__/smart-object';
import { TextSelectionObject } from '@editor/objects/text-selection-object';

vi.mock('canvaskit-wasm', () => cvk);

describe('Selection Session Manager Tests', () => {
	let selectionSession: SelectionSession;

	const historyManager = new HistoryManager();
	const config = new Config();
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register(MockSmartObject.type, MockSmartObject);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	beforeEach(() => {
		layersManager.clearLayers();
		layersManager.clearTempLayers();

		layersManager.ensureLayer();
		selectionSession = new SelectionSession({
			layersManager,
			smartObjectsManager
		});
	});

	it('should create a selection session', () => {
		expect(selectionSession).toBeTruthy();
	});

	it('should set objects', () => {
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject]);
		const selectedObjects = selectionSession.getSelectedObjects();
		expect(selectedObjects.length).toBe(1);
	});

	it('should return objects by type', () => {
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		const textSelection = new TextSelectionObject(
			{ cellX: 2, cellY: 2, width: 3, height: 1 },
			'abc'
		);
		selectionSession.setObjects([mockSmartObject, textSelection]);

		const smartObjects = selectionSession.getObjectsByType(mockSmartObject.type);
		expect(smartObjects.length).toBe(1);
		expect(smartObjects[0].id).toBe(mockSmartObject.id);
	});

	it('should add/append objects', () => {
		const mockSmartObject1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		const mockSmartObject2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject1]);

		selectionSession.addObjects([mockSmartObject2]);
		const selectedObjects = selectionSession.getSelectedObjects();
		expect(selectedObjects.length).toBe(2);
	});

	it('should remove objects', () => {
		const mockSmartObject1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		const mockSmartObject2 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject1, mockSmartObject2]);

		selectionSession.removeObjects([mockSmartObject1.id]);
		const selectedObjects = selectionSession.getSelectedObjects();
		expect(selectedObjects.length).toBe(1);
	});

	it('should clear all objects', () => {
		const mockSmartObject1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		const mockSmartObject2 = new MockSmartObject({ cellX: 10, cellY: 10, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject1, mockSmartObject2]);

		selectionSession.clearObjects();
		expect(selectionSession.isEmpty()).toBe(true);
	});

	it('should recalculate bounding box on data change', () => {
		const mockSmartObject1 = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		const mockSmartObject2 = new MockSmartObject({ cellX: 10, cellY: 10, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject1, mockSmartObject2]);

		const boundingBox = selectionSession.boundingBox;
		expect(boundingBox.cellX).toBe(0);
		expect(boundingBox.cellY).toBe(0);
		expect(boundingBox.width).toBe(15);
		expect(boundingBox.height).toBe(15);
	});

	it('should write from temp layer to source layer on commit', () => {
		const sourceLayer = selectionSession.getSourceLayer();
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		selectionSession.commit();

		const committedObj = sourceLayer?.getObjectById(mockSmartObject.id);
		expect(committedObj).toBeTruthy();
		expect(committedObj!.id).toBe(mockSmartObject.id);
		expect(selectionSession.isEmpty()).toBe(true);
	});

	it('should persist selection on cancel (cancel behaves like commit)', () => {
		const sourceLayer = selectionSession.getSourceLayer();
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		selectionSession.cancel();

		const committedObj2 = sourceLayer?.getObjectById(mockSmartObject.id);

		expect(committedObj2).toBeFalsy();
		expect(selectionSession.isEmpty()).toBe(true);
	});

	it('should serialize and deserialize the session', () => {
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject]);

		const snapshot = selectionSession.serialize();
		const newSession = SelectionSession.fromSnapshot(snapshot, {
			layersManager,
			smartObjectsManager
		});

		expect(newSession.id).toBe(snapshot.id);
		expect(newSession.boundingBox).toEqual(snapshot.boundingBox);
		expect(newSession.getSelectedObjects().length).toBe(1);
	});

	it('should emit "session::changed" event when objects are set', () => {
		const changedSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.setObjects([mockSmartObject]);

		expect(changedSpy).toHaveBeenCalledTimes(2);
		expect(changedSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should emit "session::changed" event when objects are added', () => {
		const changedSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		expect(changedSpy).toHaveBeenCalledOnce();
		expect(changedSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should emit "session::changed" event when objects are removed', () => {
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		const changedSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		selectionSession.removeObjects([mockSmartObject.id]);

		expect(changedSpy).toHaveBeenCalledOnce();
		expect(changedSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should emit "session::changed" event when objects are cleared', () => {
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		const changedSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		selectionSession.clearObjects();

		expect(changedSpy).toHaveBeenCalledOnce();
		expect(changedSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should emit "session::committed" event on commit', () => {
		const committedSpy = vi.fn();
		selectionSession.on('session::committed', committedSpy);
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		selectionSession.commit();

		expect(committedSpy).toHaveBeenCalledOnce();
		expect(committedSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should emit "session::cancelled" when calling cancel', () => {
		const cancelledSpy = vi.fn();
		selectionSession.on('session::cancelled', cancelledSpy);
		const mockSmartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSession.addObjects([mockSmartObject]);

		selectionSession.cancel();

		expect(cancelledSpy).toHaveBeenCalledOnce();
		expect(cancelledSpy).toHaveBeenCalledWith({ session: selectionSession });
	});

	it('should commit a single object with commitObject and keep session active when others remain', () => {
		const sourceLayer = selectionSession.getSourceLayer();
		const obj1 = new MockSmartObject({ cellX: 1, cellY: 1, width: 2, height: 2 });
		const obj2 = new MockSmartObject({ cellX: 10, cellY: 10, width: 3, height: 3 });
		selectionSession.setObjects([obj1, obj2]);

		const changedSpy = vi.fn();
		const committedSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		selectionSession.on('session::committed', committedSpy);

		selectionSession.commitObject(obj1.id);

		const committed1 = sourceLayer?.getObjectById(obj1.id);
		expect(committed1).toBeTruthy();
		expect(committed1!.id).toBe(obj1.id);
		expect(selectionSession.getSelectedObjects().length).toBe(1);
		expect(layersManager._getTempLayersInternal().length).toBe(1);
		expect(changedSpy).toHaveBeenCalled();
		expect(committedSpy).not.toHaveBeenCalled();
	});

	it('should emit committed and cleanup when last object is committed via commitObject', () => {
		const sourceLayer = selectionSession.getSourceLayer();
		const obj = new MockSmartObject({ cellX: 2, cellY: 2, width: 2, height: 2 });
		selectionSession.setObjects([obj]);

		const committedSpy = vi.fn();
		selectionSession.on('session::committed', committedSpy);

		selectionSession.commitObject(obj.id);

		const committedSingle = sourceLayer?.getObjectById(obj.id);
		expect(committedSingle).toBeTruthy();
		expect(committedSingle!.id).toBe(obj.id);
		expect(selectionSession.isEmpty()).toBe(true);
		expect(committedSpy).toHaveBeenCalledOnce();
	});

	it('should write text selection back to grid on commitObject for TextSelectionObject', () => {
		selectionSession.clearObjects();

		const sourceLayer = selectionSession.getSourceLayer();
		const text = 'ab\ncd';
		const textObj = new TextSelectionObject({ cellX: 5, cellY: 6, width: 2, height: 2 }, text);
		selectionSession.addObjects([textObj]);

		selectionSession.commitObject(textObj.id);

		const read = sourceLayer!.grid.readRegion(5, 6, 2, 2);
		expect(read).toBe(text);

		expect(selectionSession.isEmpty()).toBe(true);
	});

	it('should cancel a single object with cancelObject and keep session active when others remain', () => {
		const sourceLayer = selectionSession.getSourceLayer();
		const obj1 = new MockSmartObject({ cellX: 3, cellY: 3, width: 2, height: 2 });
		const obj2 = new MockSmartObject({ cellX: 8, cellY: 8, width: 2, height: 2 });
		selectionSession.setObjects([obj1, obj2]);

		const changedSpy = vi.fn();
		const cancelledSpy = vi.fn();
		selectionSession.on('session::changed', changedSpy);
		selectionSession.on('session::cancelled', cancelledSpy);

		selectionSession.cancelObject(obj1.id);

		const committed1b = sourceLayer?.getObjectById(obj1.id);
		expect(committed1b).toBeFalsy();

		expect(selectionSession.getSelectedObjects().length).toBe(1);
		expect(layersManager._getTempLayersInternal().length).toBe(1);
		expect(changedSpy).toHaveBeenCalled();
		expect(cancelledSpy).not.toHaveBeenCalled();
	});
});
