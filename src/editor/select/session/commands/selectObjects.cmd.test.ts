import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';
import { SelectObjectsCommand } from './selectObjects.cmd';
import { SelectionSessionManager } from '../selection-session-manager';

describe('SelectObjectsCommand', () => {
	let selectionSessionManager: SelectionSessionManager;
	const historyManager = new HistoryManager();
	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit;
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
	const layersManager = new LayersManager({
		config,
		historyManager,
		layerSerializer
	});

	beforeEach(() => {
		historyManager.clear();
		layersManager.clearTempLayers();
		layersManager.clearLayers();
		layersManager.ensureLayer();
		selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
	});

	it('should create a new session and select the given objects, keeping them on source layer', () => {
		const layer = layersManager.getActiveLayer()!;
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);

		const rect = new RectangleObject({ cellX: 20, cellY: 20, width: 5, height: 5 });
		layer.addOrReplaceObject(rect);

		const command = new SelectObjectsCommand([object1, object2, rect]);

		command.execute(
			{ layersManager, config, historyManager, fontManager },
			selectionSessionManager
		);

		const activeSession = selectionSessionManager.getActiveSession();
		expect(activeSession).not.toBeNull();
		expect(activeSession?.getSelectedObjects().map((o) => o.id)).toContain(rect.id);

		const realLayer = layersManager.getRealLayer(layer.id)!;
		expect(realLayer.getObjectById(rect.id)).toBeDefined();
	});

	it('should undo the select objects operation correctly', () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const command = new SelectObjectsCommand([object1]);

		command.execute(
			{ layersManager, config, historyManager, fontManager },
			selectionSessionManager
		);
		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should redo the select objects operation correctly', () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);
		const command = new SelectObjectsCommand([object1, object2]);

		command.execute(
			{ layersManager, config, historyManager, fontManager },
			selectionSessionManager
		);
		historyManager.undo();
		historyManager.redo();

		const activeSession = selectionSessionManager.getActiveSession();
		expect(activeSession).not.toBeNull();
		expect(activeSession?.getSelectedObjects().map((o) => o.id)).toEqual([object1.id, object2.id]);
	});
});
