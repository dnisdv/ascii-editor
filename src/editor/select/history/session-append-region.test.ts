import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionAppendRegion } from './session-append-region';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Session Append Region History Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let historyManager: HistoryManager;
	let layersManager: LayersManager;
	let smartObjectsManager: SmartObjectsManager;

	const config = new Config();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const canvasKitInstance = cvk.CanvasKit as any;

	const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };
	const fontManager = new FontManager(canvasKitInstance, appFontData);
	vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
		size: 18,
		dimensions: { width: 10, height: 18 },
		lineHeight: 22
	});

	beforeEach(() => {
		historyManager = new HistoryManager();
		smartObjectsManager = new SmartObjectsManager(config);
		smartObjectsManager.register('rectangle', RectangleObject);

		const layerSerializer = new LayerSerializer(smartObjectsManager, config);
		layersManager = new LayersManager({ config, historyManager, layerSerializer });
		layersManager.clearTempLayers();
		layersManager.clearLayers();

		const activeLayer = layersManager.ensureLayer();
		layersManager.setActiveLayer(activeLayer.id);

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

	function makeTextSelection(
		x: number,
		y: number,
		w: number,
		h: number,
		layerText?: string
	): TextSelectionObject {
		const active = layersManager.getActiveLayer();
		if (!active) throw new Error('No active layer');
		if (layerText) active.grid.setToRegion(x, y, layerText);
		const content = active.grid.readRegion(x, y, w, h);
		return new TextSelectionObject({ cellX: x, cellY: y, width: w, height: h }, content);
	}

	function makeRectangleObject(x: number, y: number, w: number, h: number): RectangleObject {
		return new RectangleObject({ cellX: x, cellY: y, width: w, height: h });
	}

	it('should append a text selection and clear it from the layer', () => {
		const layer = layersManager.getActiveLayer()!;
		layer.grid.setToRegion(2, 3, 'XX\nXX');

		const obj = makeTextSelection(2, 3, 2, 2);

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [obj] });
		const session = selectionSessionManager.getActiveSession()!;

		expect(session.getSelectedObjects().length).toBe(1);
		expect(session.getSelectedObjects()[0]).toBeInstanceOf(TextSelectionObject);

		expect(layer.grid.readRegion(2, 3, 2, 2)).toBe('  \n  ');
	});

	it('should append a smart object but NOT clear it from the layer (or affect grid)', () => {
		const layer = layersManager.getActiveLayer()!;
		layer.grid.setToRegion(5, 5, 'RR\nRR');

		const rect = makeRectangleObject(5, 5, 2, 2);
		layer.addOrReplaceObject(rect);

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [rect] });

		const session = selectionSessionManager.getActiveSession()!;

		expect(session.getSelectedObjects().length).toBe(1);
		expect(session.getSelectedObjects()[0]).toBeInstanceOf(RectangleObject);

		expect(layer.grid.readRegion(5, 5, 2, 2)).toBe('RR\nRR');

		const realLayer = layersManager.getRealLayer(layer.id)!;
		expect(realLayer.objects.length).toBe(2);
	});

	it('should handle mixed selection: text selection cleared, smart object remains', () => {
		const layer = layersManager.getActiveLayer()!;

		layer.grid.setToRegion(0, 0, 'TT');
		const textObj = makeTextSelection(0, 0, 2, 1);

		layer.grid.setToRegion(0, 2, 'SS');
		const rectObj = makeRectangleObject(0, 2, 2, 1);
		layer.addOrReplaceObject(rectObj);

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [textObj, rectObj] });

		const session = selectionSessionManager.getActiveSession()!;
		const selected = session.getSelectedObjects();

		expect(selected.length).toBe(2);
		expect(layer.grid.readRegion(0, 0, 2, 1)).toBe('  ');
		expect(layer.grid.readRegion(0, 2, 2, 1)).toBe('SS');
		const realLayer = layersManager.getRealLayer(layer.id)!;
		expect(realLayer.objects.length).toBe(2);
	});

	it('should undo and redo correctly for text selection', () => {
		const layer = layersManager.getActiveLayer()!;
		layer.grid.setToRegion(2, 3, 'AB\nCD');
		const obj = makeTextSelection(2, 3, 2, 2);

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [obj] });
		expect(layer.grid.readRegion(2, 3, 2, 2)).toBe('  \n  ');
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);

		historyManager.undo();
		expect(layer.grid.readRegion(2, 3, 2, 2)).toBe('AB\nCD');
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(0);

		historyManager.redo();
		expect(layer.grid.readRegion(2, 3, 2, 2)).toBe('  \n  ');
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
	});

	it('should undo and redo correctly for smart objects', () => {
		const layer = layersManager.getActiveLayer()!;
		const rect = makeRectangleObject(10, 10, 5, 5);
		layer.addOrReplaceObject(rect);

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [rect] });
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);

		const realLayer = layersManager.getRealLayer(layer.id)!;
		expect(realLayer.objects.length).toBe(2);

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(0);
		expect(realLayer.objects.length).toBe(2);

		historyManager.redo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
		expect(realLayer.objects.length).toBe(2);
	});

	it('should do nothing if payload is empty', () => {
		const layer = layersManager.getActiveLayer()!;
		layer.grid.setToRegion(0, 0, 'XX');

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [] });

		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(0);
		expect(layer.grid.readRegion(0, 0, 2, 1)).toBe('XX');
	});

	it('should do nothing if no active session', () => {
		selectionSessionManager.cancelActiveSession();
		const obj = new TextSelectionObject({ cellX: 0, cellY: 0, width: 1, height: 1 }, 'A');

		historyManager.execute(sessionAppendRegion, 'select::session', { objects: [obj] });
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});
});
