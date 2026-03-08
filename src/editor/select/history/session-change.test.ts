import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../session/selection-session-manager';
import { sessionChange } from './session-change';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Session Change History Tests', () => {
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

	it('toggles session state between before/after snapshots via undo/redo', () => {
		const t1 = makeTextSelection(0, 0, 2, 1, 'AA');
		selectionSessionManager.getActiveSession()!.addObjects([t1]);
		const before = selectionSessionManager.serializeActiveSession()!;

		const t2 = makeTextSelection(5, 1, 1, 1, 'B');
		selectionSessionManager.getActiveSession()!.setObjects([t2]);
		const after = selectionSessionManager.serializeActiveSession()!;

		historyManager.execute(sessionChange, 'select::session', { before, after });

		let session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session!.getSelectedObjects().length).toBe(1);
		expect(session!.getSelectedObjects()[0].getProperty('transform.x')).toBe(5);

		historyManager.undo();
		session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session!.getSelectedObjects().length).toBe(1);
		expect(session!.getSelectedObjects()[0].getProperty('transform.x')).toBe(0);

		historyManager.redo();
		session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session!.getSelectedObjects().length).toBe(1);
		expect(session!.getSelectedObjects()[0].getProperty('transform.x')).toBe(5);
	});
});
