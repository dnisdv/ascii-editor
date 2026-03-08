import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { LayerController } from '@editor/layers/layer-api';
import { PopulateRegionCommand } from './populateRegion.cmd';
import { SelectionSessionManager } from '../selection-session-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';

describe('populate Region Command Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let activeLayer: LayerController;

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
		vi.resetAllMocks();
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

		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		activeLayer.addObject(mockTextObject);
	});

	it('should populate content of text grid object in text-selection-object', () => {
		activeLayer.grid.setToRegion(20, 20, 'XXX\nXXX\nXXX');

		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 20, cellY: 20, width: 3, height: 3 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });

		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		expect(session?.getSelectedObjects().length).toBe(1);

		const textSelectionObject = session?.getSelectedObjects()[0] as unknown as TextSelectionObject;
		expect(textSelectionObject.getProperty('transform.x')).toBe(20);
		expect(textSelectionObject.getProperty('transform.y')).toBe(20);
		expect(textSelectionObject.getProperty('transform.width')).toBe(3);
		expect(textSelectionObject.getProperty('transform.height')).toBe(3);
		expect(textSelectionObject.selectedText).toBe('XXX\nXXX\nXXX');
	});

	it('should populate region commiting previous session and creating a new one', () => {
		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });

		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0]).toBe(mockTextObject);
	});

	it('should populate region and create a new session if none exists', () => {
		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });
		expect(selectionSessionManager.getActiveSession()).toBeDefined();
	});

	it('should undo the populate of region to previous null session', () => {
		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });

		historyManager.undo();

		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeNull();
	});

	it('should redo the populate of region to session', () => {
		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });

		historyManager.undo();
		historyManager.redo();

		const session = selectionSessionManager.getActiveSession();
		expect(session).toBeDefined();
		expect(session?.getSelectedObjects().length).toBe(1);
		const restored = session?.getSelectedObjects()[0] as TextSelectionObject;

		expect(restored.type).toBe(mockTextObject.type);
		expect(restored.selectedText).toBe(mockTextObject.selectedText);
		expect(restored.getProperty('transform.x')).toBe(mockTextObject.getProperty('transform.x'));
		expect(restored.getProperty('transform.y')).toBe(mockTextObject.getProperty('transform.y'));
		expect(restored.getProperty('transform.width')).toBe(
			mockTextObject.getProperty('transform.width')
		);
		expect(restored.getProperty('transform.height')).toBe(
			mockTextObject.getProperty('transform.height')
		);
	});

	it('should commit text content back to original layer after undoing first populating', async () => {
		activeLayer.removeObject(mockTextObject.id);

		activeLayer.grid.setToRegion(2, 2, 'BBB\nBBB\nBBB');
		const command = new PopulateRegionCommand(
			{ layersManager, config, fontManager, historyManager },
			{ cellX: 2, cellY: 2, width: 3, height: 3 }
		);

		command.execute({ layersManager, fontManager, config, historyManager });

		expect(activeLayer.grid.readRegion(2, 2, 3, 3)).toBe('   \n   \n   ');
		historyManager.undo();
		expect(activeLayer.grid.readRegion(2, 2, 3, 3)).toBe('BBB\nBBB\nBBB');
	});
});
