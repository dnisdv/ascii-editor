import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { MockSmartObject } from '@editor/__mock__/smart-object';
import { SubtractRegionCommand } from './substractRegion.cmd';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { SelectionSessionManager } from '../selection-session-manager';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';

describe('Subtract Region Command Tests', () => {
	let selectionSessionManager: SelectionSessionManager;

	const historyManager = new HistoryManager();
	const config = new Config();
	const canvasKitInstance = cvk.CanvasKit;
	const smartObjectsManager = new SmartObjectsManager(config);
	smartObjectsManager.register('rectangle', RectangleObject);
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
		const activeLayer = layersManager.ensureLayer();
		selectionSessionManager = new SelectionSessionManager({
			layersManager,
			fontManager,
			config,
			historyManager,
			smartObjectsManager
		});
		const session = selectionSessionManager.createSession(activeLayer.id);
		selectionSessionManager.setActiveSession(session);
	});

	it('commits non-text objects (removes from session) when region intersects', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const mock = new RectangleObject({ cellX: 1, cellY: 1, width: 5, height: 5 });
		session.addObjects([mock]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 10, height: 10 }
		);

		selectionSessionManager.executeCommandOnActiveSession(command);
		expect(selectionSessionManager.getActiveSession()).toBeNull();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);

		historyManager.redo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('subtracts from TextSelectionObject and updates bounds/content', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const content = 'XXX\nXXX\nXXX';
		const tso = new TextSelectionObject({ cellX: 5, cellY: 5, width: 3, height: 3 }, content);
		session.addObjects([tso]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 5, cellY: 5, width: 1, height: 3 }
		);

		selectionSessionManager.executeCommandOnActiveSession(command);
		const active = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(active.getProperty('transform.x')).toBe(6);
		expect(active.getProperty('transform.y')).toBe(5);
		expect(active.getProperty('transform.width')).toBe(2);
		expect(active.getProperty('transform.height')).toBe(3);
		expect(active.selectedText).toBe('XX\nXX\nXX');

		historyManager.undo();
		const afterUndo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterUndo.getProperty('transform.x')).toBe(5);
		expect(afterUndo.getProperty('transform.width')).toBe(3);
		expect(afterUndo.selectedText).toBe(content);

		historyManager.redo();
		const afterRedo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterRedo.getProperty('transform.x')).toBe(6);
		expect(afterRedo.getProperty('transform.width')).toBe(2);
		expect(afterRedo.selectedText).toBe('XX\nXX\nXX');
	});

	it('subtracts from TextSelectionObject with correct coords', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const content = 'XXX\nXXX\nXXX';
		const tso = new TextSelectionObject({ cellX: 5, cellY: 5, width: 3, height: 3 }, content);
		session.addObjects([tso]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 5, cellY: 4, width: 3, height: 2 }
		);

		selectionSessionManager.executeCommandOnActiveSession(command);
		const active = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(active.getProperty('transform.x')).toBe(5);
		expect(active.getProperty('transform.y')).toBe(6);
		expect(active.getProperty('transform.width')).toBe(3);
		expect(active.getProperty('transform.height')).toBe(2);
		expect(active.selectedText).toBe('XXX\nXXX');

		historyManager.undo();
		const afterUndo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterUndo.getProperty('transform.x')).toBe(5);
		expect(afterUndo.getProperty('transform.width')).toBe(3);
		expect(afterUndo.selectedText).toBe(content);

		historyManager.redo();
		const afterRedo = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(afterRedo.getProperty('transform.x')).toBe(5);
		expect(afterRedo.getProperty('transform.width')).toBe(3);
		expect(afterRedo.selectedText).toBe('XXX\nXXX');
	});

	it('removes TextSelectionObject entirely when region fully covers it', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const content = 'XX\nXX';
		const tso = new TextSelectionObject({ cellX: 0, cellY: 0, width: 2, height: 2 }, content);
		session.addObjects([tso]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 0, cellY: 0, width: 2, height: 2 }
		);

		selectionSessionManager.executeCommandOnActiveSession(command);
		expect(selectionSessionManager.getActiveSession()).toBeNull();

		historyManager.undo();
		expect(selectionSessionManager.getActiveSession()!.getSelectedObjects().length).toBe(1);
		const restored = selectionSessionManager
			.getActiveSession()!
			.getSelectedObjects()[0] as TextSelectionObject;
		expect(restored.selectedText).toBe(content);

		historyManager.redo();
		expect(selectionSessionManager.getActiveSession()).toBeNull();
	});

	it('works with multiple objects (text + non-text)', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const tso = new TextSelectionObject({ cellX: 0, cellY: 0, width: 3, height: 1 }, 'XXX');
		const mock = new MockSmartObject({ cellX: 2, cellY: 0, width: 2, height: 1 });
		vi.spyOn(mock, 'hitTest').mockImplementation(() => {
			return true;
		});
		session.addObjects([tso, mock]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 2, cellY: 0, width: 2, height: 1 }
		);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(objs.length).toBe(1);
		const remaining = objs[0] as TextSelectionObject;
		expect(remaining.getProperty('transform.x')).toBe(0);
		expect(remaining.getProperty('transform.width')).toBe(2);
		expect(remaining.selectedText).toBe('XX');
	});

	it('splits verticaly when cutting a full-height middle band', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const tso = new TextSelectionObject({ cellX: 0, cellY: 0, width: 5, height: 1 }, 'XXXXX');
		session.addObjects([tso]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 2, cellY: 0, width: 0, height: 1 }
		);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(objs.length).toBe(2);
		const left = objs[0] as TextSelectionObject;
		const right = objs[1] as TextSelectionObject;
		expect(left.getProperty('transform.x')).toBe(0);
		expect(left.getProperty('transform.y')).toBe(0);
		expect(left.getProperty('transform.width')).toBe(2);
		expect(left.getProperty('transform.height')).toBe(1);
		expect(left.selectedText).toBe('XX');

		expect(right.getProperty('transform.x')).toBe(3);
		expect(right.getProperty('transform.y')).toBe(0);
		expect(right.getProperty('transform.width')).toBe(2);
		expect(right.getProperty('transform.height')).toBe(1);
		expect(right.selectedText).toBe('XX');

		historyManager.undo();
		const afterUndo = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(afterUndo.length).toBe(1);
		const restored = afterUndo[0] as TextSelectionObject;
		expect(restored.getProperty('transform.x')).toBe(0);
		expect(restored.getProperty('transform.width')).toBe(5);
		expect(restored.selectedText).toBe('XXXXX');

		historyManager.redo();
		const afterRedo = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(afterRedo.length).toBe(2);
		const [leftRedo, rightRedo] = afterRedo as TextSelectionObject[];
		expect(leftRedo.selectedText).toBe('XX');
		expect(rightRedo.selectedText).toBe('XX');
	});

	it('splits horizontally when cutting a full-width middle band', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const tso = new TextSelectionObject(
			{ cellX: 1, cellY: 1, width: 3, height: 3 },
			'XXX\nXXX\nXXX'
		);
		session.addObjects([tso]);

		const command = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 1, cellY: 2, width: 3, height: 0 }
		);
		selectionSessionManager.executeCommandOnActiveSession(command);

		const objs = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(objs.length).toBe(2);
		const top = objs[0] as TextSelectionObject;
		const bottom = objs[1] as TextSelectionObject;
		expect(top.getProperty('transform.x')).toBe(1);
		expect(top.getProperty('transform.y')).toBe(1);
		expect(top.getProperty('transform.width')).toBe(3);
		expect(top.getProperty('transform.height')).toBe(1);
		expect(top.selectedText).toBe('XXX');

		expect(bottom.getProperty('transform.x')).toBe(1);
		expect(bottom.getProperty('transform.y')).toBe(3);
		expect(bottom.getProperty('transform.width')).toBe(3);
		expect(bottom.getProperty('transform.height')).toBe(1);
		expect(bottom.selectedText).toBe('XXX');

		historyManager.undo();
		const afterUndo = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(afterUndo.length).toBe(1);
		const restored = afterUndo[0] as TextSelectionObject;
		expect(restored.getProperty('transform.x')).toBe(1);
		expect(restored.getProperty('transform.y')).toBe(1);
		expect(restored.getProperty('transform.width')).toBe(3);
		expect(restored.getProperty('transform.height')).toBe(3);
		expect(restored.selectedText).toBe('XXX\nXXX\nXXX');

		historyManager.redo();
		const afterRedo = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(afterRedo.length).toBe(2);
		const [topRedo, bottomRedo] = afterRedo as TextSelectionObject[];
		expect(topRedo.selectedText).toBe('XXX');
		expect(bottomRedo.selectedText).toBe('XXX');
	});

	it('multiple cut horizontally and vertically should work correctly', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const tso = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 3, height: 3 },
			'XXX\nXXX\nXXX'
		);
		session.addObjects([tso]);

		const firstCommand = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: -1, cellY: -1, width: 4, height: 3 }
		);

		selectionSessionManager.executeCommandOnActiveSession(firstCommand);

		const secondCommand = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 1, cellY: 0, width: 2, height: 3 }
		);
		selectionSessionManager.executeCommandOnActiveSession(secondCommand);

		const objs = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(objs.length).toBe(1);

		const remaining = objs[0] as TextSelectionObject;

		expect(remaining.getProperty('transform.x')).toBe(0);
		expect(remaining.getProperty('transform.y')).toBe(2);
		expect(remaining.getProperty('transform.width')).toBe(1);
		expect(remaining.getProperty('transform.height')).toBe(1);
		expect(remaining.selectedText).toBe('X');
	});

	it('multiple cut horizontally and vertically with big area should work correctly', () => {
		const session = selectionSessionManager.getActiveSession()!;
		const tso = new TextSelectionObject(
			{ cellX: 0, cellY: 0, width: 3, height: 3 },
			'XXX\nXXX\nXXX'
		);
		session.addObjects([tso]);

		const firstCommand = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: -1, cellY: -1, width: 4, height: 3 }
		);

		selectionSessionManager.executeCommandOnActiveSession(firstCommand);

		const secondCommand = new SubtractRegionCommand(
			{ layersManager, historyManager },
			{ cellX: 1, cellY: -1, width: 4, height: 6 }
		);
		selectionSessionManager.executeCommandOnActiveSession(secondCommand);

		const objs = selectionSessionManager.getActiveSession()!.getSelectedObjects();
		expect(objs.length).toBe(1);

		const remaining = objs[0] as TextSelectionObject;

		expect(remaining.getProperty('transform.x')).toBe(0);
		expect(remaining.getProperty('transform.y')).toBe(2);
		expect(remaining.getProperty('transform.width')).toBe(1);
		expect(remaining.getProperty('transform.height')).toBe(1);
		expect(remaining.selectedText).toBe('X');
	});
});
