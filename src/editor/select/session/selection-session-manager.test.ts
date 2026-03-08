import { describe, beforeEach, vi, it, expect } from 'vitest';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SelectionSessionManager } from './selection-session-manager';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import { LayerSerializer } from '@editor/serializer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { FontManager } from '@editor/font-manager';
vi.mock('canvaskit-wasm', () => cvk);

describe('Selection Session Manager Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
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
	const layersManager = new LayersManager({ config, historyManager, layerSerializer });

	beforeEach(() => {
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

	it('should create a selection session', () => {
		const session = selectionSessionManager.createSession();
		expect(session).toBeDefined();
	});

	it('should retrive active selection session', () => {
		const session = selectionSessionManager.createSession();
		selectionSessionManager.setActiveSession(session);
		const activeSession = selectionSessionManager.getActiveSession();
		expect(activeSession).toBe(session);
	});

	it('should execute command on manager', () => {
		const session = selectionSessionManager.createSession();
		selectionSessionManager.setActiveSession(session);
		const command = vi.mockObject({
			execute: vi.fn()
		});
		selectionSessionManager.executeCommand(command);
		expect(command.execute).toHaveBeenCalled();
	});

	it('should execute command on active session', () => {
		const session = selectionSessionManager.createSession();
		selectionSessionManager.setActiveSession(session);
		const command = vi.mockObject({
			execute: vi.fn()
		});
		selectionSessionManager.executeCommandOnActiveSession(command);
		expect(command.execute).toHaveBeenCalled();
	});

	it('should commit the session and clear the active session', () => {
		const session = selectionSessionManager.createSession();
		selectionSessionManager.setActiveSession(session);
		selectionSessionManager.commitActiveSession();
		expect(selectionSessionManager.getActiveSession()).toBe(null);
	});
});
