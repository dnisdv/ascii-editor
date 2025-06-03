import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { App, createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { HistoryControlTool } from './history-control';
import { DrawTool } from './draw-tool';
import type { ToolManager } from '@editor/tool-manager';
import type { FontManager } from '@editor/font-manager';
import type { ILayer } from '@editor/types';

vi.mock('canvaskit-wasm', () => cvk);

const createKeyboardEvent = (
	type: 'keydown' | 'keyup',
	key: string,
	ctrlKey: boolean = false,
	shiftKey: boolean = false
): KeyboardEvent => {
	return new KeyboardEvent(type, { key, ctrlKey, shiftKey, bubbles: true, cancelable: true });
};

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup',
	clientX: number,
	clientY: number,
	button: number = 0
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true });
};

describe('History Control Tool', () => {
	let core: Core;
	let app: App;
	let historyControlTool: HistoryControlTool;
	let drawTool: DrawTool;
	let camera: Camera;
	let busManager: BusManager;
	let toolManager: ToolManager;
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
		fontManager = core.getFontManager();

		drawTool = new DrawTool(core);
		app.registerTool(drawTool);

		historyControlTool = new HistoryControlTool(core);
		app.registerTool(historyControlTool);

		activeLayer = core.getLayersManager().ensureLayer();

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
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

	const performDrawAction = (cellX: number, cellY: number, symbol: string) => {
		toolManager.activateTool(drawTool.name);
		document.dispatchEvent(createKeyboardEvent('keydown', symbol));

		const coords = cellToWorld(cellX, cellY);
		selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', coords.x, coords.y));
		window.dispatchEvent(createMouseEvent('mouseup', coords.x, coords.y));
	};

	it('should not be visible in the toolbar', () => {
		expect(historyControlTool.visible).toBe(false);
	});

	describe('Undo Functionality', () => {
		it('should undo the last action when Ctrl+Z is pressed', () => {
			const initialChar = activeLayer.getChar(1, 1);
			performDrawAction(1, 1, 'A');
			expect(activeLayer.getChar(1, 1)).toBe('A');

			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(1, 1)).toBe(initialChar);
		});

		it('should do nothing if Ctrl+Z is pressed with no history', () => {
			const initialChar = activeLayer.getChar(1, 1);
			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(1, 1)).toBe(initialChar);
		});
	});

	describe('Redo Functionality', () => {
		it('should redo the last undone action when Ctrl+Shift+Z is pressed', () => {
			const initialChar = activeLayer.getChar(1, 1);
			performDrawAction(1, 1, 'C');
			expect(activeLayer.getChar(1, 1)).toBe('C');

			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(1, 1)).toBe(initialChar);
			vi.clearAllMocks();

			document.dispatchEvent(createKeyboardEvent('keydown', 'Z', true, true));
			expect(activeLayer.getChar(1, 1)).toBe('C');
		});

		it('should redo the last undone action when Ctrl+Y is pressed', () => {
			const initialChar = activeLayer.getChar(1, 1);
			performDrawAction(1, 1, 'E');
			expect(activeLayer.getChar(1, 1)).toBe('E');

			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(1, 1)).toBe(initialChar);
			vi.clearAllMocks();

			document.dispatchEvent(createKeyboardEvent('keydown', 'y', true));

			expect(activeLayer.getChar(1, 1)).toBe('E');
		});

		it('should do nothing if Ctrl+Shift+Z is pressed with no actions to redo', () => {
			performDrawAction(1, 1, 'F');
			expect(activeLayer.getChar(1, 1)).toBe('F');

			document.dispatchEvent(createKeyboardEvent('keydown', 'Z', true, true));
			expect(activeLayer.getChar(1, 1)).toBe('F');
		});
	});

	describe('Multiple Undo/Redo Operations', () => {
		it('should correctly handle multiple undo and redo operations', () => {
			const initialChar00 = activeLayer.getChar(0, 0);
			const initialChar10 = activeLayer.getChar(1, 0);

			performDrawAction(0, 0, 'X');
			performDrawAction(1, 0, 'Y');

			expect(activeLayer.getChar(0, 0)).toBe('X');
			expect(activeLayer.getChar(1, 0)).toBe('Y');

			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(0, 0)).toBe('X');
			expect(activeLayer.getChar(1, 0)).toBe(initialChar10);

			document.dispatchEvent(createKeyboardEvent('keydown', 'z', true));
			expect(activeLayer.getChar(0, 0)).toBe(initialChar00);
			expect(activeLayer.getChar(1, 0)).toBe(initialChar10);

			document.dispatchEvent(createKeyboardEvent('keydown', 'Z', true, true));
			expect(activeLayer.getChar(0, 0)).toBe('X');
			expect(activeLayer.getChar(1, 0)).toBe(initialChar10);

			document.dispatchEvent(createKeyboardEvent('keydown', 'Z', true, true));
			expect(activeLayer.getChar(0, 0)).toBe('X');
			expect(activeLayer.getChar(1, 0)).toBe('Y');
		});
	});
});
