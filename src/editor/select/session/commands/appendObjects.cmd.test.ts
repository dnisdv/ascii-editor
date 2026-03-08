import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { AppendObjectsCommand } from './appendObjects.cmd';
import { LayerController } from '@editor/layers/layer-api';
import { SelectionSessionManager } from '../selection-session-manager';

describe('AppendObjectsCommand', () => {
	let selectionSessionManager: SelectionSessionManager;
	let activeLayer: LayerController;
	const historyManager = new HistoryManager();
	const config = new Config();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const canvasKitInstance = cvk.CanvasKit as any;
	const smartObjectsManager = new SmartObjectsManager(config);
	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };
	const fontManager = new FontManager(canvasKitInstance, appFontData);
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
		size: 18,
		dimensions: { width: 10, height: 18 },
		lineHeight: 22
	});

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
	});

	it('should create a new session when none exists', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const command = new AppendObjectsCommand({ historyManager }, { objects: [object1] });

		await selectionSessionManager.executeCommand(command);

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session?.getSelectedObjects().map((o) => o.id)).toEqual([object1.id]);
	});

	it('should append objects to existing session', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);

		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);
		session.addObjects([object1]);

		const command = new AppendObjectsCommand({ historyManager }, { objects: [object2] });
		await selectionSessionManager.executeCommand(command);

		expect(session.getSelectedObjects().map((o) => o.id)).toEqual([object2.id, object1.id]);
	});

	it('should support undo when creating a new session', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const command = new AppendObjectsCommand({ historyManager }, { objects: [object1] });

		await selectionSessionManager.executeCommand(command);
		expect(selectionSessionManager.getActiveSession()).not.toBeNull();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should support redo when creating a new session', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const command = new AppendObjectsCommand({ historyManager }, { objects: [object1] });

		await selectionSessionManager.executeCommand(command);
		historyManager.undo();
		historyManager.redo();

		const session = selectionSessionManager.getActiveSession();
		expect(session).not.toBeNull();
		expect(session?.getSelectedObjects().map((o) => o.id)).toEqual([object1.id]);
	});

	it('should support undo when appending to existing session', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);

		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);
		session.addObjects([object1]);

		const command = new AppendObjectsCommand({ historyManager }, { objects: [object2] });
		await selectionSessionManager.executeCommand(command);
		expect(session.getSelectedObjects().length).toBe(2);

		historyManager.undo();
		const restoredSession = selectionSessionManager.getActiveSession();
		expect(restoredSession).not.toBeNull();
		expect(restoredSession?.getSelectedObjects().map((o) => o.id)).toEqual([object1.id]);
	});

	it('should support redo when appending to existing session', async () => {
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const object2 = new TextSelectionObject(
			{ cellX: 10, cellY: 10, width: 5, height: 5 },
			'BBBBB\nBBBBB\nBBBBB\nBBBBB\nBBBBB'
		);

		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);
		session.addObjects([object1]);

		const command = new AppendObjectsCommand({ historyManager }, { objects: [object2] });
		await selectionSessionManager.executeCommand(command);
		expect(session.getSelectedObjects().length).toBe(2);

		historyManager.undo();
		historyManager.redo();

		const restoredSession = selectionSessionManager.getActiveSession();
		expect(restoredSession).not.toBeNull();
		expect(restoredSession?.getSelectedObjects().map((o) => o.id)).toEqual([
			object2.id,
			object1.id
		]);
	});

	it('should not create a session if no active layer', async () => {
		layersManager.clearLayers();
		const object1 = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		const command = new AppendObjectsCommand({ historyManager }, { objects: [object1] });

		await selectionSessionManager.executeCommand(command);
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should not append empty objects array', async () => {
		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);

		const command = new AppendObjectsCommand({ historyManager }, { objects: [] });
		await selectionSessionManager.executeCommand(command);

		expect(session.getSelectedObjects().length).toBe(0);
	});
});
