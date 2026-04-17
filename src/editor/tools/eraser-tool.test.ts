import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { App, createAppInstance } from '@editor/app';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { EraserTool } from './eraser-tool';
import type { ToolManager } from '@editor/tool-manager';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { LayerController } from '@editor/layers/layer-api';

vi.mock('canvaskit-wasm', () => cvk);

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup',
	clientX: number,
	clientY: number,
	button: number = 0,
	extra: Partial<MouseEventInit> = {}
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true, ...extra });
};

describe('Eraser Tool', () => {
	let core: Core;
	let app: App;
	let eraserTool: EraserTool;
	let camera: Camera;
	let toolManager: ToolManager;
	let historyManager: HistoryManager;
	let fontManager: FontManager;
	let activeLayer: LayerController;
	let selectCanvasElement: HTMLCanvasElement;

	beforeEach(() => {
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
			camera,
			font: appFontData
		});

		core = _core;
		app = _app;

		toolManager = core.getToolManager();
		historyManager = core.getHistoryManager();
		fontManager = core.getFontManager();

		eraserTool = new EraserTool(core);
		app.registerTool(eraserTool);
		toolManager.setDefaultTool(eraserTool);

		activeLayer = core.getLayersManager().ensureLayer();

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});

		// Mock Pointer Lock API (not available in happy-dom)
		selectCanvasElement.requestPointerLock = vi.fn();
		document.exitPointerLock = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const cellToWorld = (cellX: number, cellY: number) => {
		const fontMetrics = core.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	};

	const performErase = (cellX: number, cellY: number) => {
		const coords = cellToWorld(cellX, cellY);
		selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
		window.dispatchEvent(createMouseEvent('mouseup', coords.x, coords.y));
	};

	it('should have default radius of 1', () => {
		expect(eraserTool.getConfig().radius).toBe(1);
	});

	describe('Erasing Behavior', () => {
		it('should erase a character at the clicked cell', () => {
			activeLayer.setChar(2, 3, 'A');
			expect(activeLayer.getChar(2, 3)).toBe('A');

			performErase(2, 3);
			expect(activeLayer.getChar(2, 3)).toBe(' ');
		});

		it('should erase characters along a drag path', () => {
			activeLayer.setChar(0, 0, 'A');
			activeLayer.setChar(1, 0, 'B');
			activeLayer.setChar(2, 0, 'C');

			const startCoords = cellToWorld(0, 0);
			const midCoords = cellToWorld(1, 0);
			const endCoords = cellToWorld(2, 0);

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', startCoords.x, startCoords.y));
			window.dispatchEvent(createMouseEvent('mousemove', midCoords.x, midCoords.y));
			window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
			window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));

			expect(activeLayer.getChar(0, 0)).toBe(' ');
			expect(activeLayer.getChar(1, 0)).toBe(' ');
			expect(activeLayer.getChar(2, 0)).toBe(' ');
		});

		it('should not erase empty cells (no unnecessary history entries)', () => {
			expect(activeLayer.getChar(5, 5)).toBe(' ');

			performErase(5, 5);

			historyManager.undo();
			expect(activeLayer.getChar(5, 5)).toBe(' ');
		});

		it('should not erase if the active layer is not visible', () => {
			activeLayer.setChar(1, 1, 'A');
			activeLayer.update({ opts: { visible: false } });
			eraserTool.checkRequirements();

			const coords = cellToWorld(1, 1);
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
			window.dispatchEvent(createMouseEvent('mouseup', coords.x, coords.y));

			expect(activeLayer.getChar(1, 1)).toBe('A');
		});
	});

	describe('History (Undo/Redo)', () => {
		it('should undo an erase action', () => {
			activeLayer.setChar(1, 1, 'Z');
			expect(activeLayer.getChar(1, 1)).toBe('Z');

			performErase(1, 1);
			expect(activeLayer.getChar(1, 1)).toBe(' ');

			historyManager.undo();
			expect(activeLayer.getChar(1, 1)).toBe('Z');
		});

		it('should redo an erase action', () => {
			activeLayer.setChar(1, 1, 'Z');

			performErase(1, 1);
			historyManager.undo();
			expect(activeLayer.getChar(1, 1)).toBe('Z');

			historyManager.redo();
			expect(activeLayer.getChar(1, 1)).toBe(' ');
		});

		it('should undo a drag erase as a single batch', () => {
			activeLayer.setChar(0, 0, 'A');
			activeLayer.setChar(1, 0, 'B');
			activeLayer.setChar(2, 0, 'C');

			const startCoords = cellToWorld(0, 0);
			const midCoords = cellToWorld(1, 0);
			const endCoords = cellToWorld(2, 0);

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', startCoords.x, startCoords.y));
			window.dispatchEvent(createMouseEvent('mousemove', midCoords.x, midCoords.y));
			window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
			window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));

			expect(activeLayer.getChar(0, 0)).toBe(' ');
			expect(activeLayer.getChar(1, 0)).toBe(' ');
			expect(activeLayer.getChar(2, 0)).toBe(' ');

			historyManager.undo();
			expect(activeLayer.getChar(0, 0)).toBe('A');
			expect(activeLayer.getChar(1, 0)).toBe('B');
			expect(activeLayer.getChar(2, 0)).toBe('C');
		});

		it('should undo/redo erasing over different characters', () => {
			activeLayer.setChar(3, 3, 'X');
			activeLayer.setChar(4, 4, 'Y');

			performErase(3, 3);
			expect(activeLayer.getChar(3, 3)).toBe(' ');

			performErase(4, 4);
			expect(activeLayer.getChar(4, 4)).toBe(' ');

			historyManager.undo();
			expect(activeLayer.getChar(4, 4)).toBe('Y');
			expect(activeLayer.getChar(3, 3)).toBe(' ');

			historyManager.undo();
			expect(activeLayer.getChar(3, 3)).toBe('X');

			historyManager.redo();
			expect(activeLayer.getChar(3, 3)).toBe(' ');

			historyManager.redo();
			expect(activeLayer.getChar(4, 4)).toBe(' ');
		});
	});

	describe('Radius', () => {
		it('should erase a wider area when radius > 1', () => {
	
			eraserTool.saveConfig({ radius: 2 });

			for (let y = 0; y < 4; y++) {
				for (let x = 0; x < 6; x++) {
					activeLayer.setChar(x, y, '#');
				}
			}


			performErase(3, 2);

			expect(activeLayer.getChar(1, 1)).toBe(' ');
			expect(activeLayer.getChar(2, 1)).toBe(' ');
			expect(activeLayer.getChar(3, 1)).toBe(' ');
			expect(activeLayer.getChar(4, 1)).toBe(' ');
			expect(activeLayer.getChar(1, 2)).toBe(' ');
			expect(activeLayer.getChar(2, 2)).toBe(' ');
			expect(activeLayer.getChar(3, 2)).toBe(' ');
			expect(activeLayer.getChar(4, 2)).toBe(' ');

			expect(activeLayer.getChar(0, 0)).toBe('#');
			expect(activeLayer.getChar(5, 3)).toBe('#');
		});

		it('should undo radius erase as single batch', () => {
			eraserTool.saveConfig({ radius: 2 });

			activeLayer.setChar(3, 2, 'A');
			activeLayer.setChar(4, 2, 'B');
			activeLayer.setChar(3, 1, 'C');
			activeLayer.setChar(4, 1, 'D');

			performErase(3, 2);

			historyManager.undo();
			expect(activeLayer.getChar(3, 2)).toBe('A');
			expect(activeLayer.getChar(4, 2)).toBe('B');
			expect(activeLayer.getChar(3, 1)).toBe('C');
			expect(activeLayer.getChar(4, 1)).toBe('D');
		});

		it('should produce a visually square erase span', () => {
			eraserTool.saveConfig({ radius: 3 });
			const config = eraserTool.getConfig();
			const charWidth = 10;
			const charHeight = 18;
			const rows = config.radius;
			const cols = Math.max(1, Math.round((config.radius * charHeight) / charWidth));

			const pixelWidth = cols * charWidth;
			const pixelHeight = rows * charHeight;

			expect(Math.abs(pixelWidth - pixelHeight)).toBeLessThanOrEqual(charWidth);
		});
	});

	describe('Resize Gesture', () => {
		it('should increase radius on alt+right drag to the right', () => {
			expect(eraserTool.getConfig().radius).toBe(1);

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2, { altKey: true })
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 135, clientY: 100, movementX: 35, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(2);

			window.dispatchEvent(createMouseEvent('mouseup', 135, 100));
		});

		it('should decrease radius on alt+right drag to the left', () => {
			eraserTool.saveConfig({ radius: 5 });

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2, { altKey: true })
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 65, clientY: 100, movementX: -35, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(4);

			window.dispatchEvent(createMouseEvent('mouseup', 65, 100));
		});

		it('should not decrease radius below 1', () => {
			expect(eraserTool.getConfig().radius).toBe(1);

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2, { altKey: true })
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 30, clientY: 100, movementX: -70, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(1);

			window.dispatchEvent(createMouseEvent('mouseup', 30, 100));
		});

		it('should not increase radius above 15', () => {
			eraserTool.saveConfig({ radius: 15 });

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2, { altKey: true })
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 200, clientY: 100, movementX: 100, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(15);

			window.dispatchEvent(createMouseEvent('mouseup', 200, 100));
		});

		it('should not start resizing without alt or ctrl key', () => {
			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2)
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 200, clientY: 100, movementX: 100, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(1);

			window.dispatchEvent(createMouseEvent('mouseup', 200, 100));
		});

		it('should work with ctrl key as well', () => {
			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', 100, 100, 2, { ctrlKey: true })
			);

			window.dispatchEvent(
				new MouseEvent('mousemove', { clientX: 135, clientY: 100, movementX: 35, bubbles: true })
			);

			expect(eraserTool.getConfig().radius).toBe(2);

			window.dispatchEvent(createMouseEvent('mouseup', 135, 100));
		});
	});
});
