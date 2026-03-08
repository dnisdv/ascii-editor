import { describe, beforeEach, it, expect, vi } from 'vitest';
import { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { Config } from '@editor/config';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { LayerSerializer } from '@editor/serializer';
import { FontManager } from '@editor/font-manager';
import { RectangleObject } from '@editor/tools/shape/rectangle-object';
import { SelectionSessionManager } from '../selection-session-manager';
import { BringForwardCommand } from './bringForward.cmd';
import { SendBackwardCommand } from './sendBackward.cmd';
import { BringToFrontCommand } from './bringToFront.cmd';
import { SendToBackCommand } from './sendToBack.cmd';
import { SelectObjectsCommand } from './selectObjects.cmd';

describe('Arrangement Commands', () => {
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
	const layersManager = new LayersManager({
		config,
		historyManager,
		layerSerializer
	});

	let obj1: RectangleObject;
	let obj2: RectangleObject;
	let obj3: RectangleObject;
	let obj4: RectangleObject;

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

		const layer = layersManager.getActiveLayer()!;
		layer.removeAllObjects();

		obj1 = new RectangleObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
		obj2 = new RectangleObject({ cellX: 10, cellY: 10, width: 5, height: 5 });
		obj3 = new RectangleObject({ cellX: 20, cellY: 20, width: 5, height: 5 });
		obj4 = new RectangleObject({ cellX: 30, cellY: 30, width: 5, height: 5 });

		layer.addOrReplaceObject(obj1, 0);
		layer.addOrReplaceObject(obj2, 1);
		layer.addOrReplaceObject(obj3, 2);
		layer.addOrReplaceObject(obj4, 3);
	});

	const getOrder = () => {
		const layer = layersManager.getActiveLayer()!;
		return layer.getObjects().map((o) => o.id);
	};

	describe('BringForwardCommand (Up / -1 Index)', () => {
		it('should move selected object up (lower index)', () => {
			const selectCmd = new SelectObjectsCommand([obj3]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringForwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);
		});

		it('should not move if already at top (index 0)', () => {
			const selectCmd = new SelectObjectsCommand([obj1]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringForwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);
		});
	});

	describe('SendBackwardCommand (Down / +1 Index)', () => {
		it('should move selected object down (higher index)', () => {
			const selectCmd = new SelectObjectsCommand([obj2]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new SendBackwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);
		});

		it('should not move if already at bottom (last index)', () => {
			const selectCmd = new SelectObjectsCommand([obj4]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new SendBackwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);
		});
	});

	describe('BringToFrontCommand (Top / Index 0)', () => {
		it('should move selected object to index 0', () => {
			const selectCmd = new SelectObjectsCommand([obj3]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringToFrontCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order[0]).toBe(obj3.id);
			expect(order).toEqual([obj3.id, obj1.id, obj2.id, obj4.id]);
		});
	});

	describe('SendToBackCommand (Bottom / Last Index)', () => {
		it('should move selected object to last index', () => {
			const selectCmd = new SelectObjectsCommand([obj2]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new SendToBackCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order[3]).toBe(obj2.id);
			expect(order).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);
		});
	});

	describe('Multiple Selection', () => {
		it('should move multiple objects forward together', () => {
			const selectCmd = new SelectObjectsCommand([obj3, obj4]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringForwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			const order = getOrder();
			expect(order).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);
		});
	});

	describe('History / Undo / Redo', () => {
		it('should undo and redo BringForwardCommand', () => {
			const selectCmd = new SelectObjectsCommand([obj3]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringForwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			expect(getOrder()).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);

			historyManager.undo();
			expect(getOrder()).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);

			historyManager.redo();
			expect(getOrder()).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);
		});

		it('should undo and redo SendBackwardCommand', () => {
			const selectCmd = new SelectObjectsCommand([obj2]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new SendBackwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			expect(getOrder()).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);

			historyManager.undo();
			expect(getOrder()).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);

			historyManager.redo();
			expect(getOrder()).toEqual([obj1.id, obj3.id, obj2.id, obj4.id]);
		});

		it('should undo and redo BringToFrontCommand', () => {
			const selectCmd = new SelectObjectsCommand([obj3]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringToFrontCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			expect(getOrder()).toEqual([obj3.id, obj1.id, obj2.id, obj4.id]);

			historyManager.undo();
			expect(getOrder()).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);

			historyManager.redo();
			expect(getOrder()).toEqual([obj3.id, obj1.id, obj2.id, obj4.id]);
		});

		it('should undo and redo SendToBackCommand', () => {
			const selectCmd = new SelectObjectsCommand([obj2]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new SendToBackCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			expect(getOrder()).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);

			historyManager.undo();
			expect(getOrder()).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);

			historyManager.redo();
			expect(getOrder()).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);
		});

		it('should undo and redo multiple object movement', () => {
			const selectCmd = new SelectObjectsCommand([obj3, obj4]);
			selectCmd.execute(
				{ layersManager, config, historyManager, fontManager },
				selectionSessionManager
			);

			const cmd = new BringForwardCommand();
			cmd.execute({ layersManager, config, historyManager, fontManager }, selectionSessionManager);

			expect(getOrder()).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);

			historyManager.undo();
			expect(getOrder()).toEqual([obj1.id, obj2.id, obj3.id, obj4.id]);

			historyManager.redo();
			expect(getOrder()).toEqual([obj1.id, obj3.id, obj4.id, obj2.id]);
		});
	});
});
