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
import { ResizeByCommand } from './resizeSession.cmd';
import { SelectionSessionManager } from '../selection-session-manager';

describe('ResizeBy Command Tests', () => {
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

		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		selectionSession.addObjects([mockTextObject]);
		selectionSessionManager.setActiveSession(selectionSession);
	});

	it('should resize the selected objects by the specified amount', () => {
		const command = new ResizeByCommand({ historyManager }, { dx: 5, dy: 10, dw: 0, dh: 0 });

		selectionSessionManager.executeCommandOnActiveSession(command);

		const activeObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObj.getProperty('transform.x')).toBe(6);
		expect(activeObj.getProperty('transform.y')).toBe(11);
	});

	it('should resize the selected objects by the specified amount in negative direction', () => {
		const command = new ResizeByCommand({ historyManager }, { dx: -5, dy: -10, dw: 0, dh: 0 });

		selectionSessionManager.executeCommandOnActiveSession(command);

		const activeObjNeg = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObjNeg.getProperty('transform.x')).toBe(-4);
		expect(activeObjNeg.getProperty('transform.y')).toBe(-9);
	});

	it('should not resize if all objects are not capable of moving', () => {
		const mockTextObject2 = new TextSelectionObject(
			{ cellX: 2, cellY: 3, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);
		mockTextObject.capabilities.canResize = false;
		mockTextObject2.capabilities.canResize = false;

		selectionSession.addObjects([mockTextObject2]);

		const command = new ResizeByCommand({ historyManager }, { dx: 5, dy: 10, dw: 0, dh: 0 });
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects() as TextSelectionObject[];
		const obj1 = objs.find((o) => o.id === mockTextObject.id)!;
		const obj2 = objs.find((o) => o.id === mockTextObject2.id)!;
		expect(obj1.getProperty('transform.x')).toBe(1);
		expect(obj1.getProperty('transform.y')).toBe(1);
		expect(obj2.getProperty('transform.x')).toBe(2);
		expect(obj2.getProperty('transform.y')).toBe(3);
	});

	it('should undo the resize operation by restoring the original position', () => {
		const command = new ResizeByCommand({ historyManager }, { dx: 5, dy: 10, dw: 0, dh: 0 });

		selectionSessionManager.executeCommandOnActiveSession(command);
		historyManager.undo();

		const activeObjAfterUndo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObjAfterUndo.getProperty('transform.x')).toBe(1);
		expect(activeObjAfterUndo.getProperty('transform.y')).toBe(1);
	});

	it('should redo the resize operation correctly', () => {
		const command = new ResizeByCommand({ historyManager }, { dx: 5, dy: 10, dw: 0, dh: 0 });

		selectionSessionManager.executeCommandOnActiveSession(command);
		historyManager.undo();
		historyManager.redo();

		const activeObjAfterRedo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObjAfterRedo.getProperty('transform.x')).toBe(6);
		expect(activeObjAfterRedo.getProperty('transform.y')).toBe(11);
	});
});
