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
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		selectionSession.addObjects([mockTextObject]);
	});

	it('should rotate the selected objects by the specified amount', () => {
		const command = new RotateByCommand({ historyManager }, 90);

		selectionSessionManager.executeCommandOnActiveSession(command);

		const activeObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObj.getProperty('transform.rotation')).toBe(90);
	});

	it('should roatate the selected objects by the specified amount in negative direction', () => {
		const command = new RotateByCommand({ historyManager }, -90);

		selectionSessionManager.executeCommandOnActiveSession(command);

		const activeObj = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObj.getProperty('transform.rotation')).toBe(-90);
	});

	it('should not rotate if all objects are not capable of rotating', () => {
		const mockTextObject2 = new TextSelectionObject(
			{ cellX: 2, cellY: 3, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);
		mockTextObject.capabilities.canRotate = false;
		mockTextObject2.capabilities.canRotate = false;

		selectionSession.addObjects([mockTextObject2]);

		const command = new RotateByCommand({ historyManager }, 180);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects() as TextSelectionObject[];
		const obj1 = objs.find((o) => o.id === mockTextObject.id)!;
		const obj2 = objs.find((o) => o.id === mockTextObject2.id)!;
		expect(obj1.getProperty('transform.rotation')).toBe(0);
		expect(obj2.getProperty('transform.rotation')).toBe(0);
	});

	it('should undo the rotate operation by restoring the original position', () => {
		const command = new RotateByCommand({ historyManager }, 90);

		selectionSessionManager.executeCommandOnActiveSession(command);
		historyManager.undo();

		const activeObjAfterUndo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObjAfterUndo.getProperty('transform.rotation')).toBe(0);
	});

	it('should redo the rotation operation correctly', () => {
		const command = new RotateByCommand({ historyManager }, 90);

		selectionSessionManager.executeCommandOnActiveSession(command);
		historyManager.undo();
		historyManager.redo();

		const activeObjAfterRedo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(activeObjAfterRedo.getProperty('transform.rotation')).toBe(90);
	});
});
