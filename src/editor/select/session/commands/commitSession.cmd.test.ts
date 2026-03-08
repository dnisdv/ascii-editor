import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { LayerController } from '@editor/layers/layer-api';
import { SelectionSessionManager } from '../selection-session-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { CommitSessionCommand } from './commitSession.cmd';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

const RABBIT_DRAWING = ` |-|   |-| 
 | |   | | 
 | |   | | 
 | |   | | 
 | |   | | 
 --------- 
|xx    xx |
|xx    xx |
|   V     |
-----------`;

describe('Commit Session Command Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let activeLayer: LayerController;

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
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	beforeEach(() => {
		layersManager.clearTempLayers();
		layersManager.clearLayers();

		activeLayer = layersManager.ensureLayer();
		selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
	});

	it('should do nothing if there is no active session', () => {
		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should commit the active session and clear it', () => {
		const text = RABBIT_DRAWING;
		const obj = new TextSelectionObject(
			{ cellX: 25, cellY: 25, width: 11, height: text.split('\n').length },
			text
		);

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);
		activeSession.setObjects([obj]);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should write selected text content to the source layer grid on commit', () => {
		const text = RABBIT_DRAWING;
		const lines = text.split('\n');
		const width = lines.reduce((m, l) => Math.max(m, l.length), 0);
		const height = lines.length;
		const x = 25,
			y = 25;
		const textSelectionObject = new TextSelectionObject(
			{ cellX: x, cellY: y, width, height },
			text
		);

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);
		activeSession.setObjects([textSelectionObject]);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		const committed = activeLayer.grid.readRegion(x, y, width, height);
		expect(committed).toBe(text);
		expect(activeLayer.grid).toBeDefined();
	});

	it('should undo the commit operation restoring the session', () => {
		const text = RABBIT_DRAWING;
		const lines = text.split('\n');
		const width = lines.reduce((m, l) => Math.max(m, l.length), 0);
		const height = lines.length;
		const x = 10,
			y = 10;
		const obj = new TextSelectionObject({ cellX: x, cellY: y, width, height }, text);

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);
		activeSession.setObjects([obj]);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		historyManager.undo();

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session?.getSelectedObjects().length).toBe(1);
		const restoredObj = session!.getSelectedObjects()[0] as TextSelectionObject;
		expect(restoredObj.type).toBe('text-selection');
		expect(restoredObj.selectedText).toBe(obj.selectedText);
		expect(restoredObj.getProperty('transform.x')).toBe(x);
		expect(restoredObj.getProperty('transform.y')).toBe(y);
		expect(restoredObj.getProperty('transform.width')).toBe(width);
		expect(restoredObj.getProperty('transform.height')).toBe(height);

		const restored = activeLayer.grid.readRegion(x, y, width, height);
		expect(restored).toBe(lines.map(() => ' '.repeat(width)).join('\n'));
	});

	it('should redo to clear the session again (grid remains as last changed by undo/redo cycle)', () => {
		const text = RABBIT_DRAWING;
		const lines = text.split('\n');
		const width = lines.reduce((m, l) => Math.max(m, l.length), 0);
		const height = lines.length;
		const x = 8,
			y = 8;
		const obj = new TextSelectionObject({ cellX: x, cellY: y, width, height }, text);

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);
		activeSession.setObjects([obj]);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		historyManager.undo();
		const afterUndo = activeLayer.grid.readRegion(x, y, width, height);
		expect(afterUndo).toBe(lines.map(() => ' '.repeat(width)).join('\n'));

		historyManager.redo();
		const afterRedo = selectionSessionManager.getActiveSession();
		expect(afterRedo).toBeNull();

		const gridAfterRedo = activeLayer.grid.readRegion(x, y, width, height);
		expect(gridAfterRedo).toBe(text);
	});

	it('should commit a rectangle smart object onto the source layer', () => {
		const x = 12,
			y = 7,
			w = 6,
			h = 4;
		const rect = new RectangleObject({ cellX: x, cellY: y, width: w, height: h });

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);
		activeSession.setObjects([rect]);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		expect(selectionSessionManager.getActiveSession()).toBeNull();
		const objs = activeLayer.getObjects();
		const found = objs.find(
			(o) =>
				o.type === 'rectangle' &&
				Math.round(o.getProperty<number>('transform.x')) === x &&
				Math.round(o.getProperty<number>('transform.y')) === y &&
				Math.round(o.getProperty<number>('transform.width')) === w &&
				Math.round(o.getProperty<number>('transform.height')) === h
		);
		expect(!!found).toBe(true);
	});

	it('should commit smart objects changes to source layer and revert on undo', () => {
		const rect = new RectangleObject({ cellX: 10, cellY: 10, width: 5, height: 5 });
		activeLayer.addOrReplaceObject(rect);

		const activeSession = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		selectionSessionManager.setActiveSession(activeSession);

		activeSession.addObjects([rect]);
		const sessionRect = activeSession.getSelectedObjects().find((o) => o.id === rect.id)!;

		sessionRect.setProperty('transform.x', 20);

		const command = new CommitSessionCommand();
		command.execute(
			{ layersManager, fontManager, config, historyManager },
			selectionSessionManager
		);

		expect(selectionSessionManager.getActiveSession()).toBeNull();

		const committedRect = activeLayer.getObjectById(rect.id)!;
		expect(committedRect.getProperty('transform.x')).toBe(20);

		historyManager.undo();

		expect(selectionSessionManager.getActiveSession()).not.toBeNull();

		const revertedRect = activeLayer.getObjectById(rect.id)!;
		expect(revertedRect.getProperty('transform.x')).toBe(20);
	});
});
