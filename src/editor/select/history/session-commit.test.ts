import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionCommit } from './session-commit';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Session Commit History Tests', () => {
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

	function makeTextSelection(x: number, y: number, w: number, h: number, contentText: string) {
		return new TextSelectionObject({ cellX: x, cellY: y, width: w, height: h }, contentText);
	}

	it('should commit session content to the layer', () => {
		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();

		const textObj = makeTextSelection(0, 0, 5, 1, 'HELLO');
		session!.addObjects([textObj]);

		historyManager.execute(sessionCommit, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		const activeLayer = layersManager.getActiveLayer();
		const content = activeLayer!.grid.readRegion(0, 0, 5, 1);
		expect(content).toBe('HELLO');
	});

	it('should undo commit and restore session', () => {
		const session = selectionSessionManager.getActiveSession();
		const textObj = makeTextSelection(0, 0, 5, 1, 'HELLO');
		session!.addObjects([textObj]);

		historyManager.execute(sessionCommit, 'select::session');
		historyManager.undo();

		const restoredSession = selectionSessionManager.getActiveSession();
		expect(restoredSession).toBeDefined();
		expect(restoredSession!.getSelectedObjects()).toHaveLength(1);

		const activeLayer = layersManager.getActiveLayer();
		const content = activeLayer!.grid.readRegion(0, 0, 5, 1);

		expect(content.trim()).toBe('');
	});

	it('should redo commit', () => {
		const session = selectionSessionManager.getActiveSession();
		const textObj = makeTextSelection(0, 0, 5, 1, 'HELLO');
		session!.addObjects([textObj]);

		historyManager.execute(sessionCommit, 'select::session');
		historyManager.undo();
		historyManager.redo();

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		const activeLayer = layersManager.getActiveLayer();
		expect(activeLayer!.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');
	});

	it('should handle overwriting existing content and restore it on undo', () => {
		const activeLayer = layersManager.getActiveLayer();
		activeLayer!.grid.setToRegion(0, 0, 'WORLD');

		const session = selectionSessionManager.getActiveSession();
		const textObj = makeTextSelection(0, 0, 5, 1, 'HELLO');

		session!.addObjects([textObj]);

		historyManager.execute(sessionCommit, 'select::session');

		expect(activeLayer!.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');

		historyManager.undo();

		expect(activeLayer!.grid.readRegion(0, 0, 5, 1).trim()).toBe('');

		expect(selectionSessionManager.getActiveSession()).toBeDefined();
		const selectedObject = selectionSessionManager.getActiveSession()!.getSelectedObjects()[0]!;
		expect(selectedObject.toString?.()).toBe('HELLO');
	});

	it('should commit smart objects correctly', () => {
		const session = selectionSessionManager.getActiveSession();
		const rect = new RectangleObject({ cellX: 2, cellY: 2, width: 3, height: 3 });
		session!.addObjects([rect]);

		historyManager.execute(sessionCommit, 'select::session');

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		const activeLayer = layersManager.getActiveLayer();

		expect(activeLayer!.grid).toBeDefined();
		expect(activeLayer!.getObjects()).toHaveLength(2);
		const rectObj = activeLayer!.getObjects().find((o) => o.type === 'rectangle');
		expect(rectObj).toBeDefined();
	});

	it('should restore smart objects to session on undo', () => {
		const session = selectionSessionManager.getActiveSession();
		const rect = new RectangleObject({ cellX: 2, cellY: 2, width: 3, height: 3 });
		session!.addObjects([rect]);

		historyManager.execute(sessionCommit, 'select::session');
		historyManager.undo();

		const realLayer = layersManager.getRealLayer(layersManager.getActiveLayerKey()!)!;
		expect(realLayer.grid).toBeDefined();
		expect(realLayer.objects).toHaveLength(2);
		expect(realLayer.objects.some((o) => o.type === 'rectangle')).toBe(true);

		const activeLayer = layersManager.getActiveLayer();
		expect(activeLayer!.grid).toBeDefined();
		expect(activeLayer!.getObjects()).toHaveLength(2);

		const restoredSession = selectionSessionManager.getActiveSession();
		expect(restoredSession).toBeDefined();
		expect(restoredSession!.getSelectedObjects()).toHaveLength(1);
		expect(restoredSession!.getSelectedObjects()[0].type).toBe('rectangle');
	});

	it('should do nothing if no active session', () => {
		selectionSessionManager.commitActiveSession();
		expect(selectionSessionManager.getActiveSession()).toBeNull();

		const initialHistoryLength = historyManager.getHistory().length;

		historyManager.execute(sessionCommit, 'select::session');

		expect(historyManager.getHistory().length).toBe(initialHistoryLength);
	});

	it('should handle mixed content (text and smart objects)', () => {
		const session = selectionSessionManager.getActiveSession();
		const textObj = makeTextSelection(0, 0, 5, 1, 'HELLO');
		const rect = new RectangleObject({ cellX: 0, cellY: 2, width: 3, height: 3 });
		session!.addObjects([textObj, rect]);

		historyManager.execute(sessionCommit, 'select::session');

		const activeLayer = layersManager.getActiveLayer();
		expect(activeLayer!.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');

		expect(activeLayer!.grid).toBeDefined();
		expect(activeLayer!.getObjects()).toHaveLength(2);
		expect(activeLayer!.getObjects().some((o) => o.type === 'rectangle')).toBe(true);

		historyManager.undo();

		expect(activeLayer!.grid.readRegion(0, 0, 5, 1).trim()).toBe('');

		const realLayer = layersManager.getRealLayer(layersManager.getActiveLayerKey()!)!;
		expect(realLayer.objects).toHaveLength(2);
		expect(realLayer.objects.some((o) => o.type === 'rectangle')).toBe(true);

		const restoredSession = selectionSessionManager.getActiveSession();
		expect(restoredSession!.getSelectedObjects()).toHaveLength(2);
	});
});
