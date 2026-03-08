import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionSelect } from './session-select';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';
import type { CanvasKit } from 'canvaskit-wasm';

describe('Session Select History Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let historyManager: HistoryManager;
	let layersManager: LayersManager;

	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit as unknown as CanvasKit;

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
		layersManager.ensureLayer();

		selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
	});

	function makeTextSelection(x: number, y: number, w: number, h: number, layerText?: string) {
		const active = layersManager.getActiveLayer();
		if (!active) throw new Error('No active layer');

		if (layerText) active.grid.setToRegion(x, y, layerText);
		const content = active.grid.readRegion(x, y, w, h);

		return new TextSelectionObject({ cellX: x, cellY: y, width: w, height: h }, content);
	}

	function makeRectangle(x: number, y: number, w: number, h: number) {
		const active = layersManager.getActiveLayer();
		if (!active) throw new Error('No active layer');
		const rect = new RectangleObject({ cellX: x, cellY: y, width: w, height: h });
		active.addObject(rect);
		return rect;
	}

	it('should do nothing when payload has no objects', () => {
		const historyLenBefore = historyManager.getHistory().length;
		historyManager.execute(sessionSelect, 'select::session', { objects: null, restore: false });
		expect(historyManager.getHistory().length).toBe(historyLenBefore);
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should initialize a new session containing the selected objects', () => {
		const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
		historyManager.execute(sessionSelect, 'select::session', {
			objects: [selection],
			restore: true
		});

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session?.getSelectedObjects().length).toBe(1);

		const sessionObject = session?.getSelectedObjects()[0] as TextSelectionObject;
		expect(sessionObject).toBeInstanceOf(TextSelectionObject);
		expect(sessionObject.selectedText).toBe('HELLO');
	});

	it('should terminate existing session and start a new one when selecting again', () => {
		const selection1 = makeTextSelection(0, 0, 5, 1, 'HELLO');
		historyManager.execute(sessionSelect, 'select::session', {
			objects: [selection1],
			restore: true
		});
		const session1 = selectionSessionManager.getActiveSession();

		const selection2 = makeTextSelection(0, 1, 5, 1, 'WORLD');
		historyManager.execute(sessionSelect, 'select::session', {
			objects: [selection2],
			restore: true
		});
		const session2 = selectionSessionManager.getActiveSession();

		expect(session2).not.toBe(session1);
		expect(session2?.getSelectedObjects()[0]).toEqual(selection2);

		const sessionObject = session2?.getSelectedObjects()[0] as TextSelectionObject;
		expect(sessionObject.selectedText).toBe('WORLD');
	});

	describe('Text Selection (Cut Behavior - restore: true)', () => {
		it('should clear the selected text region from the source layer upon execution', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');
			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: true
			});
			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');
		});

		it('should restore the cleared text to the source layer when undoing', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: true
			});
			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');

			historyManager.undo();
			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');
			expect(selectionSessionManager.getActiveSession()).toBeNull();
		});

		it('should restore the session and clear the source layer again when redoing', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: true
			});
			historyManager.undo();
			historyManager.redo();

			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');
			expect(selectionSessionManager.getActiveSession()).not.toBeNull();

			const session = selectionSessionManager.getActiveSession();
			const sessionObject = session?.getSelectedObjects()[0] as TextSelectionObject;
			expect(sessionObject.selectedText).toBe('HELLO');
		});
	});

	describe('Text Selection (Copy/Delete Behavior - restore: false)', () => {
		it('should clear the selected text region from the source layer upon execution', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: false
			});

			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');
		});

		it('should NOT restore the cleared text to the source layer when undoing', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: false
			});
			historyManager.undo();

			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');
			expect(selectionSessionManager.getActiveSession()).toBeNull();
		});

		it('should restore the session but NOT modify the source layer when redoing', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: false
			});
			historyManager.undo();

			historyManager.redo();

			expect(layer.grid.readRegion(0, 0, 5, 1).trim()).toBe('');
			expect(selectionSessionManager.getActiveSession()).not.toBeNull();

			const session = selectionSessionManager.getActiveSession();
			const sessionObject = session?.getSelectedObjects()[0] as TextSelectionObject;
			expect(sessionObject.selectedText).toBe('HELLO');
		});
	});

	describe('Smart Objects (Rectangle - Copy Behavior)', () => {
		it('should initialize a new session containing the selected rectangle', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			historyManager.execute(sessionSelect, 'select::session', { objects: [rect], restore: true });

			const session = selectionSessionManager.getActiveSession();
			expect(session).not.toBeNull();
			expect(session?.getSelectedObjects().length).toBe(1);

			const sessionObject = session?.getSelectedObjects()[0] as RectangleObject;
			expect(sessionObject).toBeInstanceOf(RectangleObject);
			expect(sessionObject.id).toBe(rect.id);
		});

		it('should NOT remove the rectangle from the source layer upon execution (restore: true)', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;

			const initialCount = layer.getObjects().length;

			historyManager.execute(sessionSelect, 'select::session', { objects: [rect], restore: true });

			expect(layer.getObjects().length).toBe(initialCount);
			expect(realLayer.getObjectById(rect.id)).toBeDefined();
		});

		it('should NOT duplicate the rectangle on the source layer when undoing (restore: true)', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;
			const initialCount = layer.getObjects().length;

			historyManager.execute(sessionSelect, 'select::session', { objects: [rect], restore: true });
			expect(layer.getObjects().length).toBe(initialCount);

			historyManager.undo();
			expect(layer.getObjects().length).toBe(initialCount);
			expect(realLayer.getObjectById(rect.id)).toBeDefined();
		});

		it('should NOT remove the rectangle from the source layer upon execution (restore: false)', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;
			const initialCount = layer.getObjects().length;

			historyManager.execute(sessionSelect, 'select::session', { objects: [rect], restore: false });

			expect(layer.getObjects().length).toBe(initialCount);
			expect(realLayer.getObjectById(rect.id)).toBeDefined();
		});
		it('should update the source object with changes from session upon commit', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;

			historyManager.execute(sessionSelect, 'select::session', { objects: [rect], restore: true });
			const session = selectionSessionManager.getActiveSession()!;
			const sessionRect = session.getSelectedObjects()[0] as RectangleObject;

			sessionRect.setProperty('transform.x', 10);
			sessionRect.setProperty('transform.y', 10);

			selectionSessionManager.commitActiveSession();

			const sourceRect = realLayer.getObjectById(rect.id) as RectangleObject;
			expect(sourceRect).toBeDefined();
			expect(sourceRect.getProperty('transform.x')).toBe(10);
			expect(sourceRect.getProperty('transform.y')).toBe(10);
		});
	});

	describe('Multiple Objects Selection', () => {
		it('should handle selecting multiple objects (Text + Rectangle) correctly', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const textSelection = makeTextSelection(6, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;

			const initialRectCount = layer.getObjects().length;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [rect, textSelection],
				restore: true
			});

			const session = selectionSessionManager.getActiveSession();
			expect(session).not.toBeNull();
			expect(session?.getSelectedObjects().length).toBe(2);

			expect(layer.grid.readRegion(6, 0, 5, 1).trim()).toBe('');
			expect(realLayer.getObjectById(rect.id)).toBeDefined();
			expect(layersManager.getRealLayer(layer.id)!.getObjects().length).toBe(initialRectCount);
		});

		it('should restore multiple objects correctly on undo', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const textSelection = makeTextSelection(6, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;
			const realLayer = layersManager.getRealLayer(layer.id)!;
			const initialRectCount = layer.getObjects().length;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [rect, textSelection],
				restore: true
			});
			historyManager.undo();

			expect(layer.grid.readRegion(6, 0, 5, 1)).toBe('HELLO');

			expect(layer.getObjects().length).toBe(initialRectCount);
			expect(realLayer.getObjectById(rect.id)).toBeDefined();

			expect(selectionSessionManager.getActiveSession()).toBeNull();
		});

		it('should re-apply selection of multiple objects on redo', () => {
			const rect = makeRectangle(0, 0, 5, 5);
			const textSelection = makeTextSelection(6, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [rect, textSelection],
				restore: true
			});
			historyManager.undo();
			historyManager.redo();

			const session = selectionSessionManager.getActiveSession();
			expect(session).not.toBeNull();
			expect(session?.getSelectedObjects().length).toBe(2);

			expect(layer.grid.readRegion(6, 0, 5, 1).trim()).toBe('');
		});
	});

	describe('Text Selection (Duplicate Behavior - clearRegion: false)', () => {
		it('should NOT clear the selected text region from the source layer upon execution', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: true,
				clearRegion: false
			});

			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');

			const session = selectionSessionManager.getActiveSession();
			expect(session).not.toBeNull();
			const sessionObject = session?.getSelectedObjects()[0] as TextSelectionObject;
			expect(sessionObject.selectedText).toBe('HELLO');
		});

		it('should NOT clear the source layer when redoing', () => {
			const selection = makeTextSelection(0, 0, 5, 1, 'HELLO');
			const layer = layersManager.getActiveLayer()!;

			historyManager.execute(sessionSelect, 'select::session', {
				objects: [selection],
				restore: true,
				clearRegion: false
			});

			historyManager.undo();
			expect(selectionSessionManager.getActiveSession()).toBeNull();
			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');

			historyManager.redo();

			expect(layer.grid.readRegion(0, 0, 5, 1)).toBe('HELLO');
			expect(selectionSessionManager.getActiveSession()).not.toBeNull();
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty object list gracefully', () => {
			const historyLenBefore = historyManager.getHistory().length;
			historyManager.execute(sessionSelect, 'select::session', { objects: [], restore: true });

			expect(historyManager.getHistory().length).toBe(historyLenBefore);
			expect(selectionSessionManager.getActiveSession()).toBeNull();
		});

		it('should handle selection when no active layer exists (if possible)', () => {
			layersManager.clearLayers();

			const dummySelection = new TextSelectionObject(
				{ cellX: 0, cellY: 0, width: 1, height: 1 },
				'A'
			);

			const historyLenBefore = historyManager.getHistory().length;
			historyManager.execute(sessionSelect, 'select::session', {
				objects: [dummySelection],
				restore: true
			});

			expect(historyManager.getHistory().length).toBe(historyLenBefore);
			expect(selectionSessionManager.getActiveSession()).toBeNull();
		});
	});
});
