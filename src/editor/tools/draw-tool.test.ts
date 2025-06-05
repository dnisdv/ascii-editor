import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { App, createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { DrawTool } from './draw-tool';
import type { ToolManager } from '@editor/tool-manager';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { ILayer } from '@editor/types';

vi.mock('canvaskit-wasm', () => cvk);

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave',
	clientX: number,
	clientY: number,
	button: number = 0
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true });
};

const createKeyboardEvent = (
	type: 'keydown' | 'keyup',
	key: string,
	ctrlKey: boolean = false,
	metaKey: boolean = false,
	shiftKey: boolean = false
): KeyboardEvent => {
	return new KeyboardEvent(type, {
		key,
		ctrlKey,
		metaKey,
		shiftKey,
		bubbles: true,
		cancelable: true
	});
};

describe('Draw Tool', () => {
	let core: Core;
	let app: App;
	let drawTool: DrawTool;
	let camera: Camera;
	let busManager: BusManager;
	let toolManager: ToolManager;
	let historyManager: HistoryManager;
	let fontManager: FontManager;
	let activeLayer: ILayer;
	let selectCanvasElement: HTMLCanvasElement;

	beforeEach(() => {
		busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		camera = new Camera(1200, 800);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const canvasKitInstance = cvk.CanvasKit as any;
		const appFontData = { buffer: new ArrayBuffer(8), family: 'TestAppFont' };

		const gridEl = document.createElement('canvas');
		selectCanvasElement = document.createElement('canvas');
		const asciiEl = document.createElement('canvas');

		const [_core, _app] = createAppInstance({
			canvasKitInstance,
			gridCanvasElement: gridEl,
			selectCanvasElement,
			asciiCanvasElement: asciiEl,
			busManager,
			camera,
			font: appFontData
		});

		core = _core;
		app = _app;

		toolManager = core.getToolManager();
		historyManager = core.getHistoryManager();
		fontManager = core.getFontManager();

		drawTool = new DrawTool(core);
		app.registerTool(drawTool);
		toolManager.setDefaultTool(drawTool);

		activeLayer = core.getLayersManager().ensureLayer();

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	const cellToWorld = (cellX: number, cellY: number) => {
		const fontMetrics = core.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	};

	const performDraw = (cellX: number, cellY: number, symbol?: string) => {
		if (symbol) {
			document.dispatchEvent(createKeyboardEvent('keydown', symbol));
		}
		const coords = cellToWorld(cellX, cellY);
		selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
		window.dispatchEvent(createMouseEvent('mouseup', coords.x, coords.y));
	};

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should have a default activeSymbol "X"', () => {
		expect(drawTool.getConfig().activeSymbol).toBe('X');
	});

	describe('Drawing Behavior with Mouse', () => {
		it('should draw the active symbol on the active layer when clicking and dragging', () => {
			const startCoords = cellToWorld(2, 3);
			const midCoords = cellToWorld(3, 3);
			const endCoords = cellToWorld(4, 4);
			const activeSymbol = drawTool.getConfig().activeSymbol;

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', startCoords.x, startCoords.y)
			);
			expect(activeLayer.getChar(2, 3)).toBe(activeSymbol);

			window.dispatchEvent(createMouseEvent('mousemove', midCoords.x, midCoords.y));
			expect(activeLayer.getChar(3, 3)).toBe(activeSymbol);

			window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
			expect(activeLayer.getChar(4, 4)).toBe(activeSymbol);

			window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));
		});

		it('should not draw if the active layer is not visible', () => {
			const fontMetrics = core.getFontManager().getMetrics();
			const charWidth = fontMetrics?.dimensions?.width;

			activeLayer.update({ opts: { visible: false } });
			drawTool.checkRequirements();

			const coords = cellToWorld(1, 1);
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousemove', coords.x + charWidth, coords.y)
			);
			selectCanvasElement.dispatchEvent(
				createMouseEvent('mouseup', coords.x + charWidth, coords.y)
			);
			expect(activeLayer.getChar(1, 1)).toBe(' ');
		});

		it('should stop drawing and commit history if layer becomes invisible during drag', () => {
			const startCoords = cellToWorld(0, 0);
			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', startCoords.x, startCoords.y)
			);
			activeLayer.setChar(0, 0, 'A');
			activeLayer.update({ opts: { visible: false } });
			expect(activeLayer.getChar(0, 0)).toBe('A');
		});
	});

	describe('Active Symbol Change with Keyboard', () => {
		it('should change activeSymbol and save config when a character key is pressed', () => {
			const newSymbol = 'A';
			document.dispatchEvent(createKeyboardEvent('keydown', newSymbol));
			expect(drawTool.getConfig().activeSymbol).toBe(newSymbol);
		});

		it('should not change activeSymbol for non-character keys like Shift', () => {
			const initialSymbol = drawTool.getConfig().activeSymbol;
			document.dispatchEvent(createKeyboardEvent('keydown', 'Shift'));
			expect(drawTool.getConfig().activeSymbol).toBe(initialSymbol);
		});
	});

	describe('History Behavior (Undo/Redo)', () => {
		it('should correctly undo/redo a drawing action', () => {
			const drawCoords = cellToWorld(1, 1);
			const initialChar = activeLayer.getChar(1, 1);
			const activeSymbol = drawTool.getConfig().activeSymbol;

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			window.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));

			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);

			historyManager.undo();
			expect(activeLayer.getChar(1, 1)).toBe(initialChar);

			historyManager.redo();
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);
		});

		it('should correctly undo/redo a sequence of drawing actions (drag)', () => {
			const startCoords = cellToWorld(0, 0);
			const midCoords = cellToWorld(1, 0);
			const endCoords = cellToWorld(2, 0);

			const initialChar00 = activeLayer.getChar(0, 0);
			const initialChar10 = activeLayer.getChar(1, 0);
			const initialChar20 = activeLayer.getChar(2, 0);
			const activeSymbol = drawTool.getConfig().activeSymbol;

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', startCoords.x, startCoords.y)
			);
			window.dispatchEvent(createMouseEvent('mousemove', midCoords.x, midCoords.y));
			window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
			window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));

			expect(activeLayer.getChar(0, 0)).toBe(activeSymbol);
			expect(activeLayer.getChar(1, 0)).toBe(activeSymbol);
			expect(activeLayer.getChar(2, 0)).toBe(activeSymbol);

			historyManager.undo();
			expect(activeLayer.getChar(0, 0)).toBe(initialChar00);
			expect(activeLayer.getChar(1, 0)).toBe(initialChar10);
			expect(activeLayer.getChar(2, 0)).toBe(initialChar20);

			historyManager.redo();
			expect(activeLayer.getChar(0, 0)).toBe(activeSymbol);
			expect(activeLayer.getChar(1, 0)).toBe(activeSymbol);
			expect(activeLayer.getChar(2, 0)).toBe(activeSymbol);
		});

		it('should undo/redo correctly after changing active symbol', () => {
			performDraw(0, 0, 'A');
			expect(activeLayer.getChar(0, 0)).toBe('A');

			performDraw(1, 1, 'B');
			expect(activeLayer.getChar(1, 1)).toBe('B');
			expect(drawTool.getConfig().activeSymbol).toBe('B');

			historyManager.undo();
			expect(activeLayer.getChar(1, 1)).toBe(' ');
			expect(activeLayer.getChar(0, 0)).toBe('A');

			expect(drawTool.getConfig().activeSymbol).toBe('B');

			historyManager.undo();
			expect(activeLayer.getChar(0, 0)).toBe(' ');

			historyManager.redo();
			expect(activeLayer.getChar(0, 0)).toBe('A');
			expect(drawTool.getConfig().activeSymbol).toBe('B');

			historyManager.redo();
			expect(activeLayer.getChar(1, 1)).toBe('B');
			expect(drawTool.getConfig().activeSymbol).toBe('B');
		});

		it('should undo/redo drawing over an existing character', () => {
			activeLayer.setChar(1, 1, 'O');
			expect(activeLayer.getChar(1, 1)).toBe('O');

			performDraw(1, 1, 'X');
			expect(activeLayer.getChar(1, 1)).toBe('X');

			historyManager.undo();
			expect(activeLayer.getChar(1, 1)).toBe('O');

			historyManager.redo();
			expect(activeLayer.getChar(1, 1)).toBe('X');
		});

		it('should allow new drawing after an undo operation', () => {
			performDraw(0, 0, 'A');
			expect(activeLayer.getChar(0, 0)).toBe('A');

			historyManager.undo();
			expect(activeLayer.getChar(0, 0)).toBe(' ');

			performDraw(0, 0, 'B');
			expect(activeLayer.getChar(0, 0)).toBe('B');

			historyManager.undo();
			expect(activeLayer.getChar(0, 0)).toBe(' ');

			historyManager.redo();
			expect(activeLayer.getChar(0, 0)).toBe('B');

			historyManager.undo();
			historyManager.redo();

			expect(activeLayer.getChar(0, 0)).toBe('B');
		});
	});

	describe('Tool State', () => {
		it('drawing actions should be on layer after tool deactivation', () => {
			const drawCoords = cellToWorld(1, 1);
			const activeSymbol = drawTool.getConfig().activeSymbol;
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);
			drawTool.deactivate();
			selectCanvasElement.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);
		});

		it('drawing actions should persist on layer after active layer changes if history is not undone', () => {
			const drawCoords = cellToWorld(1, 1);
			const activeSymbol = drawTool.getConfig().activeSymbol;
			const originalLayerId = activeLayer.id;

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			expect(core.getLayersManager().getLayer(originalLayerId)?.getChar(1, 1)).toBe(activeSymbol);
			const [, newLayer] = core.getLayersManager().addLayer();
			core.getLayersManager().setActiveLayer(newLayer.id);
			selectCanvasElement.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));

			expect(core.getLayersManager().getLayer(originalLayerId)?.getChar(1, 1)).toBe(activeSymbol);
		});

		it('drawing actions should persist on layer after its visibility changes if history is not undone', () => {
			const drawCoords = cellToWorld(1, 1);
			const activeSymbol = drawTool.getConfig().activeSymbol;

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			selectCanvasElement.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);

			activeLayer.update({ opts: { visible: false } });
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);

			activeLayer.update({ opts: { visible: true } });
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);
		});

		it('should allow drawing if tool requirements (layer visible) are met', () => {
			activeLayer.update({ opts: { visible: true } });
			expect(drawTool.checkRequirements()).toBe(true);

			const drawCoords = cellToWorld(1, 1);
			const activeSymbol = drawTool.getConfig().activeSymbol;
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			selectCanvasElement.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));
			expect(activeLayer.getChar(1, 1)).toBe(activeSymbol);
		});

		it('should prevent drawing if tool requirements (layer visible) are NOT met', () => {
			activeLayer.update({ opts: { visible: false } });
			expect(drawTool.checkRequirements()).toBe(false);

			const drawCoords = cellToWorld(1, 1);
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', drawCoords.x, drawCoords.y));
			selectCanvasElement.dispatchEvent(createMouseEvent('mouseup', drawCoords.x, drawCoords.y));
			expect(activeLayer.getChar(1, 1)).toBe(' ');
		});
	});
});
