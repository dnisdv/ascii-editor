import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionRemove } from './session-remove';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Session Remove History Tests', () => {
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

	it('should remove session and delete single text object', () => {
		const layer = layersManager.getActiveLayer()!;
		const text = makeTextSelection(2, 0, 2, 1, 'AB');
		selectionSessionManager.getActiveSession()!.addObjects([text]);

		historyManager.execute(sessionRemove, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(layer.grid.readRegion(2, 0, 2, 1).trim()).toBe('');

		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).not.toBeNull();

		const sessionObjects = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(sessionObjects.length).toBe(1);

		expect((sessionObjects[0] as TextSelectionObject).selectedText).toBe('AB');
	});

	it('should remove session and delete single smart object', () => {
		const layer = layersManager.getActiveLayer()!;
		const realLayer = layersManager.getRealLayer(layer.id)!;
		const rect = new RectangleObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		selectionSessionManager.getActiveSession()!.addObjects([rect]);
		const rectId = rect.id;

		expect(realLayer.getObjectById(rectId)).toBeUndefined();

		historyManager.execute(sessionRemove, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		expect(realLayer.getObjectById(rectId)).toBeUndefined();

		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		const sessionObjects = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(sessionObjects.length).toBe(1);
		expect(sessionObjects[0].id).toBe(rectId);
		expect(sessionObjects[0]).toBeInstanceOf(RectangleObject);
	});

	it('should remove session with multiple mixed objects', () => {
		const layer = layersManager.getActiveLayer()!;
		const realLayer = layersManager.getRealLayer(layer.id)!;
		const text = makeTextSelection(0, 0, 2, 1, 'AB');
		const rect = new RectangleObject({ cellX: 0, cellY: 2, width: 3, height: 3 });

		selectionSessionManager.getActiveSession()!.addObjects([text, rect]);

		historyManager.execute(sessionRemove, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		expect(layer.grid.readRegion(0, 0, 2, 1).trim()).toBe('');
		expect(realLayer.getObjectById(rect.id)).toBeUndefined();

		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		const sessionObjects = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(sessionObjects.length).toBe(2);

		const restoredText = sessionObjects.find(
			(o) => o instanceof TextSelectionObject
		) as TextSelectionObject;
		const restoredRect = sessionObjects.find((o) => o instanceof RectangleObject);

		expect(restoredText).toBeDefined();
		expect(restoredText.selectedText).toBe('AB');
		expect(restoredRect).toBeDefined();
		expect(restoredRect!.id).toBe(rect.id);
	});

	it('should handle undo/redo cycle correctly', () => {
		const layer = layersManager.getActiveLayer()!;
		const text = makeTextSelection(0, 0, 2, 1, 'XY');
		selectionSessionManager.getActiveSession()!.addObjects([text]);

		historyManager.execute(sessionRemove, 'select::session');
		expect(selectionSessionManager.getActiveSession()).toBeNull();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
		expect(
			(selectionSessionManager.getActiveSession()!.getSelectedObjects()[0] as TextSelectionObject)
				.selectedText
		).toBe('XY');
		expect(layer.grid.readRegion(0, 0, 2, 1).trim()).toBe('');

		historyManager.redo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
		expect(layer.grid.readRegion(0, 0, 2, 1).trim()).toBe('');
	});

	it('should do nothing if no active session', () => {
		selectionSessionManager.deleteActiveSession();
		expect(selectionSessionManager.getActiveSession()).toBeNull();

		historyManager.execute(sessionRemove, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});
});
