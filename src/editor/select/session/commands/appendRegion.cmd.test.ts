import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { AppendRegionCommand } from './appendRegion.cmd';
import { LayerController } from '@editor/layers/layer-api';
import { SelectionSessionManager } from '../selection-session-manager';
import { SubtractRegionCommand } from './substractRegion.cmd';
import { MockSmartObject } from '@editor/__mock__/smart-object';

describe('Append Region Command Tests', () => {
	let selectionSessionManager: SelectionSessionManager;
	let activeLayer: LayerController;
	const historyManager = new HistoryManager();
	const config = new Config();

	const canvasKitInstance = cvk.CanvasKit;
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

	let mockTextObject: TextSelectionObject;

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

	it('should create a session if missing and append intersecting objects', async () => {
		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		activeLayer.addObject(mockTextObject);

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);
		await selectionSessionManager.executeCommand(command);

		const session = selectionSessionManager.getActiveSession();
		expect(session?.getSelectedObjects()[0].type).toBe('text-selection');
	});

	it('should correctly read content of text grid object in text selection object and append to active session', async () => {
		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		activeLayer.addObject(mockTextObject);

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		await selectionSessionManager.executeCommand(command);
		const session = selectionSessionManager.getActiveSession();
		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0].type).toBe('text-selection');

		activeLayer.grid.setToRegion(20, 20, 'XXX\nXXX\nXXX');

		const appendCommand = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 20, cellY: 20, width: 3, height: 3 }
		);

		await selectionSessionManager.executeCommand(appendCommand);

		expect(session?.getSelectedObjects().length).toBe(2);
	});

	it('should undo the append region operation correctly', async () => {
		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		activeLayer.addObject(mockTextObject);

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		await selectionSessionManager.executeCommand(command);
		const session = selectionSessionManager.getActiveSession();
		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0].type).toBe('text-selection');

		historyManager.undo();

		expect(session?.getSelectedObjects().length).toBe(0);
	});

	it('should redo the append region operation correctly', async () => {
		mockTextObject = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 5, height: 5 },
			'AAAAA\nAAAAA\nAAAAA\nAAAAA\nAAAAA'
		);
		activeLayer.addObject(mockTextObject);

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		await selectionSessionManager.executeCommand(command);

		let session = selectionSessionManager.getActiveSession();
		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0].type).toBe('text-selection');

		historyManager.undo();
		historyManager.redo();

		session = selectionSessionManager.getActiveSession();

		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0].type).toBe('text-selection');
	});

	it('should allow appending again after a subtract puts content back on the grid', async () => {
		activeLayer.grid.setToRegion(10, 10, 'XXX');
		const appendCmd1 = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 10, cellY: 10, width: 3, height: 1 }
		);
		await selectionSessionManager.executeCommand(appendCmd1);
		let session = selectionSessionManager.getActiveSession()!;
		expect(session.getSelectedObjects().length).toBeGreaterThan(0);

		const subtractCmd = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 11, cellY: 10, width: 1, height: 1 }
		);
		selectionSessionManager.executeCommandOnActiveSession(subtractCmd);

		const appendCmd2 = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 11, cellY: 10, width: 1, height: 1 }
		);
		await selectionSessionManager.executeCommand(appendCmd2);

		session = selectionSessionManager.getActiveSession()!;
		expect(session.getSelectedObjects().length).toBeGreaterThan(1);
	});

	it('should append non-text smart objects when no text selection is found', async () => {
		const mockObj = new MockSmartObject({ cellX: 50, cellY: 50, width: 2, height: 2 });
		activeLayer.addObject(mockObj);
		vi.spyOn(mockObj, 'regionHitTest').mockReturnValue(true);

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 50, cellY: 50, width: 2, height: 2 }
		);
		await selectionSessionManager.executeCommand(command);

		const session = selectionSessionManager.getActiveSession();
		expect(session?.getSelectedObjects().length).toBe(1);
		expect(session?.getSelectedObjects()[0].id).toBe(mockObj.id);
		expect(session?.getSelectedObjects()[0].type).toBe(MockSmartObject.type);
	});

	it('should commit text content back to original layer after undoing', async () => {
		activeLayer.grid.setToRegion(2, 2, 'CCC\nCCC\nCCC');
		expect(activeLayer.grid.readRegion(2, 2, 3, 3)).toBe('CCC\nCCC\nCCC');

		const command = new AppendRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 2, cellY: 2, width: 3, height: 3 }
		);

		await selectionSessionManager.executeCommand(command);

		historyManager.undo();
		expect(activeLayer.grid.readRegion(2, 2, 3, 3)).toBe('CCC\nCCC\nCCC');
		historyManager.redo();
		expect(activeLayer.grid.readRegion(2, 2, 3, 3)).toBe('   \n   \n   ');
	});
});
