import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { SelectionSessionManager } from '../selection-session-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RemoveObjectsCommand } from './removeObjects.cmd';
import { LayerController } from '@editor/layers/layer-api';

describe('RemoveObjectsCommand', () => {
	let selectionSessionManager: SelectionSessionManager;
	let activeLayer: LayerController;
	const historyManager = new HistoryManager();
	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit;
	const smartObjectsManager = new SmartObjectsManager(config);
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

	let object1: TextSelectionObject, object2: TextSelectionObject;

	beforeEach(() => {
		historyManager.clear();
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

		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);

		object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);

		session.addObjects([object1, object2]);
	});

	it('should remove specified objects from the selection session', () => {
		const command = new RemoveObjectsCommand({ historyManager }, { objectsIds: [object1.id] });
		selectionSessionManager.executeCommandOnActiveSession(command);
		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		const objs = session!.getSelectedObjects() as TextSelectionObject[];
		expect(objs.length).toBe(1);
		const remaining = objs[0];
		expect(remaining.id).toBe(object2.id);
		expect(remaining.type).toBe(object2.type);
		expect(remaining.selectedText).toBe(object2.selectedText);
		expect(remaining.getProperty('transform.x')).toBe(object2.getProperty('transform.x'));
		expect(remaining.getProperty('transform.y')).toBe(object2.getProperty('transform.y'));
		expect(remaining.getProperty('transform.width')).toBe(object2.getProperty('transform.width'));
		expect(remaining.getProperty('transform.height')).toBe(object2.getProperty('transform.height'));
	});

	it('should undo the remove operation correctly', () => {
		const command = new RemoveObjectsCommand({ historyManager }, { objectsIds: [object1.id] });
		selectionSessionManager.executeCommandOnActiveSession(command);
		let session = selectionSessionManager.getActiveSession();
		historyManager.undo();
		session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		const objs = session!.getSelectedObjects() as TextSelectionObject[];
		expect(objs.length).toBe(2);
		const descriptors = objs.map((o) => ({
			id: o.id,
			type: o.type,
			text: o.selectedText,
			x: o.getProperty('transform.x'),
			y: o.getProperty('transform.y'),
			w: o.getProperty('transform.width'),
			h: o.getProperty('transform.height')
		}));
		const expected1 = {
			id: object1.id,
			type: object1.type,
			text: object1.selectedText,
			x: object1.getProperty('transform.x'),
			y: object1.getProperty('transform.y'),
			w: object1.getProperty('transform.width'),
			h: object1.getProperty('transform.height')
		};
		const expected2 = {
			id: object2.id,
			type: object2.type,
			text: object2.selectedText,
			x: object2.getProperty('transform.x'),
			y: object2.getProperty('transform.y'),
			w: object2.getProperty('transform.width'),
			h: object2.getProperty('transform.height')
		};
		expect(descriptors).toEqual(expect.arrayContaining([expected1, expected2]));
	});

	it('should redo the remove operation correctly', () => {
		const command = new RemoveObjectsCommand({ historyManager }, { objectsIds: [object1.id] });
		selectionSessionManager.executeCommandOnActiveSession(command);

		let session = selectionSessionManager.getActiveSession();
		historyManager.undo();
		historyManager.redo();

		session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		const objs = session!.getSelectedObjects() as TextSelectionObject[];
		expect(objs.length).toBe(1);
		const remaining = objs[0];
		expect(remaining.id).toBe(object2.id);
		expect(remaining.type).toBe(object2.type);
		expect(remaining.selectedText).toBe(object2.selectedText);
		expect(remaining.getProperty('transform.x')).toBe(object2.getProperty('transform.x'));
		expect(remaining.getProperty('transform.y')).toBe(object2.getProperty('transform.y'));
		expect(remaining.getProperty('transform.width')).toBe(object2.getProperty('transform.width'));
		expect(remaining.getProperty('transform.height')).toBe(object2.getProperty('transform.height'));
	});

	it('should ignore non-existent object ids and leave selection unchanged', () => {
		const before = selectionSessionManager.getActiveSession();
		expect(before).toBeDefined();
		expect(before!.getSelectedObjects().length).toBe(2);

		const command = new RemoveObjectsCommand(
			{ historyManager },
			{ objectsIds: ['non-existent-id'] }
		);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		const objs = session!.getSelectedObjects() as TextSelectionObject[];
		expect(objs.length).toBe(2);

		const descriptors = objs.map((o) => ({
			id: o.id,
			type: o.type,
			text: o.selectedText,
			x: o.getProperty('transform.x'),
			y: o.getProperty('transform.y'),
			w: o.getProperty('transform.width'),
			h: o.getProperty('transform.height')
		}));
		const expected1 = {
			id: object1.id,
			type: object1.type,
			text: object1.selectedText,
			x: object1.getProperty('transform.x'),
			y: object1.getProperty('transform.y'),
			w: object1.getProperty('transform.width'),
			h: object1.getProperty('transform.height')
		};
		const expected2 = {
			id: object2.id,
			type: object2.type,
			text: object2.selectedText,
			x: object2.getProperty('transform.x'),
			y: object2.getProperty('transform.y'),
			w: object2.getProperty('transform.width'),
			h: object2.getProperty('transform.height')
		};
		expect(descriptors).toEqual(expect.arrayContaining([expected1, expected2]));
	});
});
