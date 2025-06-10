import type { Core } from '@editor/core';
import type { SelectionModeContext } from './modes/selection-mode-ctx';
import type { ILayer } from '@editor/types';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SelectionModeName } from './modes/modes.type';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { ExportTool } from './export-tool';
import { ClipboardTool } from '../clipboard-tool';

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave',
	clientX: number,
	clientY: number,
	buttons: number = 1
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, buttons, bubbles: true, cancelable: true });
};

const createKeyboardEvent = (
	type: 'keydown' | 'keyup',
	key: string,
	ctrlKey: boolean = false,
	shiftKey: boolean = false
): KeyboardEvent => {
	return new KeyboardEvent(type, { key, ctrlKey, shiftKey, bubbles: true, cancelable: true });
};

vi.mock('canvaskit-wasm', () => cvk);

const mockClipboardData = { text: '' };
const mockClipboard = {
	writeText: vi.fn((data: string) => {
		mockClipboardData.text = data;
		return Promise.resolve();
	}),
	readText: vi.fn(() => Promise.resolve(mockClipboardData.text))
};

describe('Export Tool', () => {
	let exportTool: ExportTool;
	let core: Core;
	let modeContext: SelectionModeContext;
	let selectCanvasElement: HTMLCanvasElement;

	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(mockClipboard as any);

		const arrayBuffer = new ArrayBuffer(8);

		const busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		const [_core, _app] = createAppInstance({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			canvasKitInstance: cvk.CanvasKit as any,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			busManager: busManager,
			camera: new Camera(1200, 1200),
			font: { buffer: arrayBuffer, family: '' }
		});

		_app.registerTool(new ExportTool(_core));

		exportTool = _app.getToolManager().getTool('export') as ExportTool;
		const toolManager = _core.getToolManager();

		_app.registerTool(new ClipboardTool(_core));
		toolManager.setDefaultTool(exportTool);

		modeContext = exportTool['modeContext'];
		selectCanvasElement = _core.getCanvases().select.canvas;
		const fontManager = _core.getFontManager();

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});

		core = _core;
	});

	afterEach(() => {
		if (core) {
			core.getToolManager().deactivateAllTools();
			exportTool.getEventApi().removeToolEvents();
		}
		vi.restoreAllMocks();
		mockClipboard.writeText.mockClear();
	});

	it('should start in IDLE mode', () => {
		expect(exportTool.modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
	});

	const performSelection = (
		startCellX: number,
		startCellY: number,
		endCellX: number,
		endCellY: number
	) => {
		const startCoords = cellToWorld(startCellX, startCellY);
		const endCoords = cellToWorld(endCellX, endCellY);

		selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', startCoords.x, startCoords.y));
		window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
		window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));
	};

	const cellToWorld = (cellX: number, cellY: number) => {
		const fontMetrics = core.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	};

	const setupLayerWithContent = (content: string, x = 0, y = 0): ILayer => {
		const layer = core.getLayersManager().addLayer()[1];
		layer.setToRegion(x, y, content);
		return layer;
	};

	it('should be in IDLE mode initially', () => {
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
	});

	describe('Selection Behavior', () => {
		it('should transition from IDLE to SELECTING to SELECTED on drag', () => {
			const startCoords = cellToWorld(5, 5);
			const endCoords = cellToWorld(10, 10);
			const modeCtx = exportTool.modeContext;

			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.IDLE);

			selectCanvasElement.dispatchEvent(
				createMouseEvent('mousedown', startCoords.x, startCoords.y)
			);
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.SELECTING);

			window.dispatchEvent(createMouseEvent('mousemove', endCoords.x, endCoords.y));
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.SELECTING);

			window.dispatchEvent(createMouseEvent('mouseup', endCoords.x, endCoords.y));
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		});

		it('should create a selection session with the correct region', () => {
			performSelection(2, 2, 7, 5);
			const session = exportTool.selectionSessionManager.getActiveSession();
			const region = session?.getSelectedRegion();

			const expectedStart = cellToWorld(2, 2);
			const {
				dimensions: { width: charWidth, height: charHeight }
			} = core.getFontManager().getMetrics();

			expect(session).not.toBeNull();
			expect(region?.startX).toBeCloseTo(expectedStart.x);
			expect(region?.startY).toBeCloseTo(expectedStart.y);
			expect(region?.width).toBeCloseTo(6 * charWidth);
			expect(region?.height).toBeCloseTo(4 * charHeight);
		});

		it('should handle dragging from bottom-right to top-left correctly', () => {
			performSelection(10, 10, 5, 5);
			const session = exportTool.selectionSessionManager.getActiveSession();
			const region = session?.getSelectedRegion();

			const expectedStart = cellToWorld(5, 5);
			expect(region?.startX).toBe(expectedStart.x);
			expect(region?.startY).toBe(expectedStart.y);
		});

		it('should transition back to IDLE if a selection is cancelled with Escape key', () => {
			performSelection(1, 1, 5, 5);
			expect(exportTool.modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			document.dispatchEvent(createKeyboardEvent('keydown', 'Escape'));
			expect(exportTool.modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
			expect(exportTool.selectionSessionManager.getActiveSession()).toBeNull();
		});
	});

	describe('Moving Selection', () => {
		it('should transition to MOVING mode and update selection on drag', () => {
			performSelection(2, 2, 4, 4);
			const session = exportTool.selectionSessionManager.getActiveSession();
			const originalRegion = { ...session!.getSelectedRegion()! };
			const modeCtx = exportTool.modeContext;

			const moveFrom = cellToWorld(3, 3);
			const moveTo = cellToWorld(8, 7);
			const {
				dimensions: { width: charWidth, height: charHeight }
			} = core.getFontManager().getMetrics();
			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', moveFrom.x, moveFrom.y));
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.MOVING);

			window.dispatchEvent(createMouseEvent('mousemove', moveTo.x, moveTo.y));

			window.dispatchEvent(createMouseEvent('mouseup', moveTo.x, moveTo.y));
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			const newRegion = session?.getSelectedRegion();
			expect(newRegion?.startX).toBeCloseTo(originalRegion.startX + 5 * charWidth);
			expect(newRegion?.startY).toBeCloseTo(originalRegion.startY + 4 * charHeight);
			expect(newRegion?.width).toBeCloseTo(originalRegion.width);
			expect(newRegion?.height).toBeCloseTo(originalRegion.height);
		});
	});

	describe('Resizing Selection', () => {
		it('should transition to RESIZING mode and update selection on drag from a corner handle', () => {
			performSelection(5, 5, 10, 10);
			const session = exportTool.selectionSessionManager.getActiveSession();
			const originalRegion = session!.getSelectedRegion()!;
			const modeCtx = exportTool.modeContext;

			const handleX = originalRegion.startX + originalRegion.width;
			const handleY = originalRegion.startY + originalRegion.height;

			const resizeTo = cellToWorld(15, 14);
			const {
				dimensions: { width: charWidth, height: charHeight }
			} = core.getFontManager().getMetrics();

			selectCanvasElement.dispatchEvent(createMouseEvent('mousedown', handleX - 1, handleY - 1));
			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.RESIZING);

			window.dispatchEvent(createMouseEvent('mousemove', resizeTo.x, resizeTo.y));
			window.dispatchEvent(createMouseEvent('mouseup', resizeTo.x, resizeTo.y));

			expect(modeCtx.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			const newRegion = session?.getSelectedRegion();
			expect(newRegion?.startX).toBeCloseTo(originalRegion.startX);
			expect(newRegion?.startY).toBeCloseTo(originalRegion.startY);
			expect(newRegion?.width).toBeCloseTo(10 * charWidth);
			expect(newRegion?.height).toBeCloseTo(9 * charHeight);
		});
	});

	describe('Export Content (Ctrl+Shift+C)', () => {
		it('should not copy if no selection is active', () => {
			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			expect(mockClipboard.writeText).not.toHaveBeenCalled();
		});

		it('should copy the content from a single layer within the selected region', () => {
			setupLayerWithContent('A\nB\nC', 1, 1);
			performSelection(1, 1, 1, 3);

			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			expect(mockClipboard.writeText).toHaveBeenCalledWith('A\nB\nC');
		});

		it('should copy content from an area with surrounding text, preserving whitespace', () => {
			setupLayerWithContent(' IGNORE \n--HELLO--\n--WORLD\nIGNORE ', 0, 0);
			performSelection(2, 1, 6, 2);

			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			expect(mockClipboard.writeText).toHaveBeenCalledWith('HELLO\nWORLD');
		});

		it('should copy content from multiple visible layers, prioritizing the top layer', () => {
			const layer1 = setupLayerWithContent('111\n111', 0, 0);
			const layer2 = setupLayerWithContent(' 2 \n2 2', 0, 0);

			layer1.updateIndex(0);
			layer2.updateIndex(1);

			performSelection(0, 0, 2, 1);
			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));

			expect(mockClipboard.writeText).toHaveBeenCalledWith('121\n212');
		});

		it('should ignore hidden layers when copying', () => {
			setupLayerWithContent('HIDDEN', 0, 0).update({ opts: { visible: false } });
			setupLayerWithContent('VISIBLE', 0, 0);

			performSelection(0, 0, 6, 0);
			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			expect(mockClipboard.writeText).toHaveBeenCalledWith('VISIBLE');
		});

		it('should not copy an area of empty space', () => {
			setupLayerWithContent('A', 0, 0);
			performSelection(5, 5, 7, 6);

			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			expect(mockClipboard.writeText).not.toHaveBeenCalled();
		});

		it('should correctly handle multi-line export with varied line lengths', () => {
			const text = 'Line1\nLine22\nLine333';
			setupLayerWithContent(text, 0, 0);
			performSelection(0, 0, 6, 2);

			document.dispatchEvent(createKeyboardEvent('keydown', 'C', true, true));
			const expected = 'Line1  \nLine22 \nLine333';
			expect(mockClipboard.writeText).toHaveBeenCalledWith(expected);
		});
	});
});
