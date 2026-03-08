import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionSubtractRegion } from './session-subtract-region';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Session Subtract Region History Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let historyManager: HistoryManager;
	let layersManager: LayersManager;

	const config = new Config();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const canvasKitInstance = cvk.CanvasKit as any;
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register('rectangle', RectangleObject);

	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };
	const fontManager = new FontManager(canvasKitInstance, appFontData);

	vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
		size: 18,
		dimensions: { width: 10, height: 18 },
		lineHeight: 22
	});

	beforeEach(() => {
		historyManager = new HistoryManager();
		layersManager = new LayersManager({ config, historyManager, layerSerializer });
		layersManager.clearTempLayers();
		layersManager.clearLayers();
		const activeLayer = layersManager.ensureLayer();

		selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);
	});

	function makeTextSelection(x: number, y: number, w: number, h: number, layerText?: string) {
		const active = layersManager.getActiveLayer();
		if (!active) throw new Error('No active layer');
		if (layerText) active.grid.setToRegion(x, y, layerText);
		const content = active.grid.readRegion(x, y, w, h);
		return new TextSelectionObject({ cellX: x, cellY: y, width: w, height: h }, content);
	}

	it('should fully remove a single text object and close session', () => {
		const layer = layersManager.getActiveLayer()!;
		layer.grid.setToRegion(0, 0, 'XXXX\nXXXX');

		const text = makeTextSelection(2, 0, 2, 1, 'AB');
		selectionSessionManager.getActiveSession()!.addObjects([text]);

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{
					objectId: selectionSessionManager.getActiveSession()!.getSelectedObjects()[0].id,
					text: 'AB',
					cellX: 2,
					cellY: 0,
					width: 2,
					height: 1
				}
			],
			modifiedTextObjects: [
				{
					objectId: selectionSessionManager.getActiveSession()!.getSelectedObjects()[0].id,
					before: { text: 'AB', cellX: 2, cellY: 0, width: 2, height: 1 },
					after: null
				}
			],
			subtractedSmartObjectsIds: [],
			addedTextObjects: []
		});

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(layer.grid.readRegion(2, 0, 2, 1)).toBe('AB');

		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).not.toBeNull();

		const restoredObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(restoredObj.getProperty('transform.x')).toBe(2);
		expect(restoredObj.getProperty('transform.width')).toBe(2);
	});

	it('should partially remove a text object', () => {
		const layer = layersManager.getActiveLayer()!;

		const textObj = new TextSelectionObject({ cellX: 0, cellY: 0, width: 4, height: 1 }, 'ABCD');
		selectionSessionManager.getActiveSession()!.addObjects([textObj]);

		layer.grid.setToRegion(0, 0, '____');
		const textId = textObj.id;

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{ objectId: textId, text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 }
			],
			modifiedTextObjects: [
				{
					objectId: textId,
					before: { text: 'ABCD', cellX: 0, cellY: 0, width: 4, height: 1 },
					after: { text: 'CD', cellX: 2, cellY: 0, width: 2, height: 1 }
				}
			],
			subtractedSmartObjectsIds: [],
			addedTextObjects: []
		});

		expect(layer.grid.readRegion(0, 0, 4, 1)).toBe('AB__');

		const sessionObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(sessionObj.selectedText).toBe('CD');
		expect(sessionObj.getProperty('transform.x')).toBe(2);

		historyManager.undo();
		expect(layer.grid.readRegion(0, 0, 4, 1)).toBe('____');

		const restoredObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(restoredObj.selectedText).toBe('ABCD');
		expect(restoredObj.getProperty('transform.x')).toBe(0);

		historyManager.redo();
		expect(layer.grid.readRegion(0, 0, 4, 1)).toBe('AB__');
		const redoObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(redoObj.selectedText).toBe('CD');
	});

	it('should do nothing with empty payload', () => {
		const layer = layersManager.getActiveLayer()!;
		const text = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'AB');
		selectionSessionManager.getActiveSession()!.addObjects([text]);

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [],
			modifiedTextObjects: [],
			subtractedSmartObjectsIds: [],
			addedTextObjects: []
		});

		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
		const region = layer.grid.readRegion(0, 0, 2, 1);
		expect(region === null || region === '  ').toBeTruthy();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
	});

	it('should return smart object to source layer', () => {
		const layer = layersManager.getActiveLayer()!;
		const realLayer = layersManager.getRealLayer(layer.id)!;
		const rect = new RectangleObject({ cellX: 0, cellY: 0, width: 5, height: 5 });

		selectionSessionManager.getActiveSession()!.addObjects([rect]);
		const rectId = rect.id;

		expect(realLayer.getObjectById(rectId)).toBeUndefined();

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [],
			modifiedTextObjects: [],
			subtractedSmartObjectsIds: [rectId],
			addedTextObjects: []
		});

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		expect(realLayer.getObjectById(rectId)).toBeDefined();
		expect(realLayer.getObjectById(rectId)).toBeInstanceOf(RectangleObject);

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects()[0].id).toBe(rectId);

		historyManager.redo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(realLayer.getObjectById(rectId)).toBeDefined();
	});

	it('should split text object when subtracting from middle', () => {
		const layer = layersManager.getActiveLayer()!;
		const textObj = new TextSelectionObject({ cellX: 0, cellY: 0, width: 5, height: 1 }, 'ABCDE');
		selectionSessionManager.getActiveSession()!.addObjects([textObj]);
		const originalId = textObj.id;

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{ objectId: originalId, text: 'C', cellX: 2, cellY: 0, width: 1, height: 1 }
			],
			modifiedTextObjects: [
				{
					objectId: originalId,
					before: { cellX: 0, cellY: 0, width: 5, height: 1, text: 'ABCDE' },
					after: { cellX: 0, cellY: 0, width: 2, height: 1, text: 'AB' }
				}
			],
			subtractedSmartObjectsIds: [],
			addedTextObjects: [{ cellX: 3, cellY: 0, width: 2, height: 1, text: 'DE' }]
		});

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		const objects = session!.getSelectedObjects();
		expect(objects.length).toBe(2);

		objects.sort(
			(a, b) => (a.getProperty('transform.x') as number) - (b.getProperty('transform.x') as number)
		);
		expect((objects[0] as TextSelectionObject).selectedText).toBe('AB');
		expect((objects[1] as TextSelectionObject).selectedText).toBe('DE');

		expect(layer.grid.readRegion(2, 0, 1, 1)).toBe('C');

		historyManager.undo();
		const undoObjects = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(undoObjects.length).toBe(1);
		expect((undoObjects[0] as TextSelectionObject).selectedText).toBe('ABCDE');

		expect(layer.grid.readRegion(2, 0, 1, 1).trim()).toBe('');
	});

	it('should subtract multiple text objects', () => {
		const layer = layersManager.getActiveLayer()!;
		const text1 = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'AB');
		const text2 = new TextSelectionObject({ cellX: 0, cellY: 1, width: 2, height: 1 }, 'CD');
		selectionSessionManager.getActiveSession()!.addObjects([text1, text2]);

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{ objectId: text1.id, text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 },
				{ objectId: text2.id, text: 'CD', cellX: 0, cellY: 1, width: 2, height: 1 }
			],
			modifiedTextObjects: [
				{
					objectId: text1.id,
					before: { text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 },
					after: null
				},
				{
					objectId: text2.id,
					before: { text: 'CD', cellX: 0, cellY: 1, width: 2, height: 1 },
					after: null
				}
			],
			subtractedSmartObjectsIds: [],
			addedTextObjects: []
		});

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(layer.grid.readRegion(0, 0, 2, 1)).toBe('AB');
		expect(layer.grid.readRegion(0, 1, 2, 1)).toBe('CD');

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(2);
	});

	it('should handle mixed subtraction of text and smart objects', () => {
		const layer = layersManager.getActiveLayer()!;
		const text = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'AB');
		const rect = new RectangleObject({ cellX: 0, cellY: 2, width: 3, height: 3 });
		selectionSessionManager.getActiveSession()!.addObjects([text, rect]);

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{ objectId: text.id, text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 }
			],
			modifiedTextObjects: [
				{
					objectId: text.id,
					before: { text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 },
					after: null
				}
			],
			subtractedSmartObjectsIds: [rect.id],
			addedTextObjects: []
		});

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(layer.grid.readRegion(0, 0, 2, 1)).toBe('AB');
		expect(layer.getObjectById(rect.id)).toBeDefined();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(2);
	});

	it('should handle partial subtraction where some objects remain untouched', () => {
		const layer = layersManager.getActiveLayer()!;
		const text1 = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 1 }, 'AB');
		const text2 = new TextSelectionObject({ cellX: 0, cellY: 2, width: 2, height: 1 }, 'CD');
		selectionSessionManager.getActiveSession()!.addObjects([text1, text2]);

		historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects: [
				{ objectId: text1.id, text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 }
			],
			modifiedTextObjects: [
				{
					objectId: text1.id,
					before: { text: 'AB', cellX: 0, cellY: 0, width: 2, height: 1 },
					after: null
				}
			],
			subtractedSmartObjectsIds: [],
			addedTextObjects: []
		});

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session!.getSelectedObjects().length).toBe(1);
		expect((session!.getSelectedObjects()[0] as TextSelectionObject).selectedText).toBe('CD');

		expect(layer.grid.readRegion(0, 0, 2, 1)).toBe('AB');

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(2);
	});
});
