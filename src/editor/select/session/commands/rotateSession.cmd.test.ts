import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { SelectionSession } from '../selection-session';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RotateByCommand } from './rotateSession.cmd';
import { SelectionSessionManager } from '../selection-session-manager';

// Asymmetric 3×2 text so rotation visibly changes content and dimensions.
// 'ABC\nDEF'  →  90°  →  'DA\nEB\nFC'  (2×3)
// 'ABC\nDEF'  →  -90° →  'CF\nBE\nAD'  (2×3)
const INITIAL_TEXT = 'ABC\nDEF';

describe('RotateBy Command Tests', () => {
	let selectionSession: SelectionSession;
	let selectionSessionManager: SelectionSessionManager;

	const historyManager = new HistoryManager();
	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit;
	const smartObjectsManager = new SmartObjectsManager(config);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };
	const fontManager = new FontManager(canvasKitInstance, appFontData);

	let mockTextObject: TextSelectionObject;

	vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
		size: 18,
		dimensions: { width: 10, height: 18 },
		lineHeight: 22
	});
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	beforeEach(() => {
		historyManager.clear();
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
		selectionSession = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(selectionSession);

		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 3, height: 2 },
			INITIAL_TEXT
		);
		selectionSession.addObjects([mockTextObject]);
	});

	it('should apply rotation: content and dimensions change after 90°', () => {
		const command = new RotateByCommand({ historyManager }, 90);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const obj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;

		// 90° on a 3×2 text swaps dimensions to 2×3 and rotates content
		expect(obj.getProperty('transform.width')).toBe(2);
		expect(obj.getProperty('transform.height')).toBe(3);
		expect(obj.selectedText).not.toBe(INITIAL_TEXT);
	});

	it('should apply rotation in negative direction: content and dimensions change after -90°', () => {
		const command = new RotateByCommand({ historyManager }, -90);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const obj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;

		expect(obj.getProperty('transform.width')).toBe(2);
		expect(obj.getProperty('transform.height')).toBe(3);
		expect(obj.selectedText).not.toBe(INITIAL_TEXT);
	});

	it('should not rotate if all objects are not capable of rotating', () => {
		const mockTextObject2 = new TextSelectionObject(
			{ cellX: 2, cellY: 3, width: 3, height: 2 },
			INITIAL_TEXT
		);
		mockTextObject.capabilities.canRotate = false;
		mockTextObject2.capabilities.canRotate = false;

		selectionSession.addObjects([mockTextObject2]);

		const command = new RotateByCommand({ historyManager }, 90);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects() as TextSelectionObject[];
		const obj1 = objs.find((o) => o.id === mockTextObject.id)!;
		const obj2 = objs.find((o) => o.id === mockTextObject2.id)!;
		expect(obj1.selectedText).toBe(INITIAL_TEXT);
		expect(obj2.selectedText).toBe(INITIAL_TEXT);
	});

	it('should undo: restores original content and dimensions', () => {
		const command = new RotateByCommand({ historyManager }, 90);
		selectionSessionManager.executeCommandOnActiveSession(command);

		historyManager.undo();

		const obj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;

		expect(obj.selectedText).toBe(INITIAL_TEXT);
		expect(obj.getProperty('transform.width')).toBe(3);
		expect(obj.getProperty('transform.height')).toBe(2);
	});

	it('should redo: reapplies rotated content and dimensions after undo', () => {
		const command = new RotateByCommand({ historyManager }, 90);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const rotatedText = mockTextObject.selectedText;
		const rotatedW = mockTextObject.getProperty('transform.width');
		const rotatedH = mockTextObject.getProperty('transform.height');

		historyManager.undo();
		historyManager.redo();

		const obj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;

		expect(obj.selectedText).toBe(rotatedText);
		expect(obj.getProperty('transform.width')).toBe(rotatedW);
		expect(obj.getProperty('transform.height')).toBe(rotatedH);
	});
});
