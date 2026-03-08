import { describe, beforeEach, it, expect, vi } from 'vitest';
import { MoveByCommand } from './moveBy.cmd';
import { LayersManager } from '@editor/layers/layers-manager';
import { SelectionSession } from '../selection-session';
import { SelectionSessionManager } from '../selection-session-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('MoveBy Command Tests', () => {
	let selectionSession: SelectionSession;
	let manager: SelectionSessionManager;

	const historyManager = new HistoryManager();
	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit;
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register('rectangle', RectangleObject);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };
	const fontManager = new FontManager(canvasKitInstance, appFontData);

	let textObj: TextSelectionObject;

	vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
		size: 18,
		dimensions: { width: 10, height: 18 },
		lineHeight: 22
	});
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	beforeEach(() => {
		layersManager.clearTempLayers();
		layersManager.clearLayers();

		layersManager.ensureLayer();
		manager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
		selectionSession = new SelectionSession({ layersManager });
		manager.setActiveSession(selectionSession);

		textObj = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		selectionSession.addObjects([textObj]);
	});

	it('should move the selected objects by the specified amount and update bounding box, but NOT move source layer objects', () => {
		const layer = layersManager.getActiveLayer()!;
		const rect = new RectangleObject({ cellX: 10, cellY: 10, width: 5, height: 5 });
		layer.addOrReplaceObject(rect);

		selectionSession.addObjects([rect]);
		const sessionRect = selectionSession.getSelectedObjects().find((o) => o.id === rect.id)!;

		const command = new MoveByCommand({ layersManager, historyManager }, { x: 5, y: 5 });

		command.execute(selectionSession);

		expect(sessionRect.getProperty('transform.x')).toBe(15);
		expect(sessionRect.getProperty('transform.y')).toBe(15);

		const sourceRect = layersManager.getRealLayer(layer.id)!.getObjectById(rect.id)!;
		expect(sourceRect.getProperty('transform.x')).toBe(10);
		expect(sourceRect.getProperty('transform.y')).toBe(10);
	});

	it('should not move objects that cannot move', () => {
		textObj.capabilities.canMove = false;
		const command = new MoveByCommand({ layersManager, historyManager }, { x: 5, y: 10 });
		command.execute(selectionSession);

		expect(textObj.getProperty('transform.x')).toBe(1);
		expect(textObj.getProperty('transform.y')).toBe(1);
		expect(selectionSession.boundingBox).toEqual({ cellX: 1, cellY: 1, width: 5, height: 5 });
	});

	it('should support undo and redo via session change history', () => {
		const command = new MoveByCommand({ layersManager, historyManager }, { x: 5, y: 10 });

		manager.executeCommandOnActiveSession(command);
		expect(textObj.getProperty('transform.x')).toBe(6);
		expect(textObj.getProperty('transform.y')).toBe(11);

		historyManager.undo();
		const afterUndoSession = manager.getActiveSession();
		expect(afterUndoSession).not.toBeNull();
		const afterUndoObj = afterUndoSession!.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterUndoObj.getProperty('transform.x')).toBe(1);
		expect(afterUndoObj.getProperty('transform.y')).toBe(1);

		historyManager.redo();
		const afterRedoSession = manager.getActiveSession();
		expect(afterRedoSession).not.toBeNull();
		const afterRedoObj = afterRedoSession!.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterRedoObj.getProperty('transform.x')).toBe(6);
		expect(afterRedoObj.getProperty('transform.y')).toBe(11);
	});

	it('should can move multiple objects together', () => {
		layersManager.clearTempLayers();
		layersManager.clearLayers();

		layersManager.ensureLayer();

		selectionSession = new SelectionSession({ layersManager });

		textObj = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		selectionSession.addObjects([textObj]);

		const rectangle = new RectangleObject({ cellX: 3, cellY: 3, width: 4, height: 4 });
		selectionSession.addObjects([rectangle]);

		const moveCommand = new MoveByCommand({ layersManager, historyManager }, { x: 2, y: 3 });
		moveCommand.execute(selectionSession);

		let textSelectionObject = selectionSession
			.getSelectedObjects()
			.find((obj) => obj.id === textObj.id) as TextSelectionObject;
		let rectangleObject = selectionSession
			.getSelectedObjects()
			.find((obj) => obj.id === rectangle.id) as RectangleObject;

		expect(textSelectionObject.getProperty('transform.x')).toBe(3);
		expect(textSelectionObject.getProperty('transform.y')).toBe(4);

		expect(rectangleObject.getProperty('transform.x')).toBe(5);
		expect(rectangleObject.getProperty('transform.y')).toBe(6);

		historyManager.undo();

		textSelectionObject = selectionSession
			.getSelectedObjects()
			.find((obj) => obj.id === textObj.id) as TextSelectionObject;
		rectangleObject = selectionSession
			.getSelectedObjects()
			.find((obj) => obj.id === rectangle.id) as RectangleObject;

		expect(textSelectionObject.getProperty('transform.x')).toBe(1);
		expect(textSelectionObject.getProperty('transform.y')).toBe(1);

		expect(rectangleObject.getProperty('transform.x')).toBe(3);
		expect(rectangleObject.getProperty('transform.y')).toBe(3);
	});
});
