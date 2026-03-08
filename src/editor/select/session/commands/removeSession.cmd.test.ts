import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { RemoveSessionCommand } from './removeSession.cmd';
import { SelectionSessionManager } from '../selection-session-manager';
import { SelectionSession } from '../selection-session';

describe('RemoveSessionCommand', () => {
	let selectionSessionManager: SelectionSessionManager;
	let session: SelectionSession;
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
		session = selectionSessionManager.createSession(layersManager.getActiveLayerKey()!);
		const object = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 5, height: 5 },
			'XXXXX\nXXXXX\nXXXXX\nXXXXX\nXXXXX'
		);
		session.addObjects([object]);
		selectionSessionManager.setActiveSession(session);
	});

	it('should remove the active session', () => {
		const command = new RemoveSessionCommand();

		command.execute({ layersManager, historyManager, fontManager, config });

		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('should undo the remove session operation correctly', () => {
		const command = new RemoveSessionCommand();

		command.execute({ layersManager, historyManager, fontManager, config });
		historyManager.undo();

		const restored = selectionSessionManager.getActiveSession();
		expect(restored).not.toBeNull();
		expect(restored?.id).toBe(session.id);

		const objs = restored!.getSelectedObjects() as TextSelectionObject[];
		expect(objs.length).toBe(1);
		expect(objs[0].type).toBe('text-selection');
	});

	it('should redo the remove session operation correctly', () => {
		const command = new RemoveSessionCommand();

		command.execute({ layersManager, historyManager, fontManager, config });
		historyManager.undo();
		historyManager.redo();

		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});
});
