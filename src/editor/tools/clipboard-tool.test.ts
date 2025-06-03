import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { App, createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { ClipboardTool } from './clipboard-tool';
import { SelectTool, type SelectToolApi } from './select/select-tool';
import type { ToolManager } from '@editor/tool-manager';
import type { FontManager } from '@editor/font-manager';
import type { ILayer } from '@editor/types';

vi.mock('canvaskit-wasm', () => cvk);

const mockClipboardData = {
	text: ''
};
const mockClipboard = {
	writeText: vi.fn((data: string) => {
		mockClipboardData.text = data;
		return Promise.resolve();
	}),
	readText: vi.fn(() => Promise.resolve(mockClipboardData.text))
};

const createKeyboardEvent = (
	type: string,
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

const createMouseEvent = (
	type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave',
	clientX: number,
	clientY: number,
	button?: number
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true });
};

describe('Clipboard Tool', () => {
	let core: Core;
	let app: App;
	let clipboardTool: ClipboardTool;
	let selectTool: SelectTool;
	let selectToolApi: SelectToolApi;
	let toolManager: ToolManager;
	let busManager: BusManager;
	let fontManager: FontManager;
	let activeLayer: ILayer;
	let selectCanvasElement: HTMLCanvasElement;

	beforeEach(() => {
		mockClipboardData.text = '';

		mockClipboard.writeText.mockClear();
		mockClipboard.readText.mockClear();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(mockClipboard as any);

		busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		const camera = new Camera(1200, 800);
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
		activeLayer = core.getLayersManager().ensureLayer();

		selectTool = new SelectTool(core);
		app.registerTool(selectTool);
		selectToolApi = toolManager.getToolApi<SelectToolApi>(selectTool.name)!;

		clipboardTool = new ClipboardTool(core);
		app.registerTool(clipboardTool);

		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	afterEach(() => {
		if (selectTool && typeof selectTool.deactivate === 'function') {
			selectTool.deactivate();
		}
		if (clipboardTool && typeof clipboardTool.deactivate === 'function') {
			clipboardTool.cleanup();
		}
		vi.restoreAllMocks();
	});

	const simulateSelection = (text: string, startX = 0, startY = 0) => {
		const width = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
		const height = text.split('\n').length;
		selectToolApi.createSessionWithContent({ startX, startY, width, height }, text, activeLayer.id);
	};

	describe('Copy Behavior (Ctrl+C)', () => {
		it('should write selected text to clipboard when content is selected', async () => {
			const selectedText = 'Hello\nWorld';
			simulateSelection(selectedText);
			expect(selectToolApi.getActiveSession()?.getSelectedContent()?.data).toBe(selectedText);

			document.dispatchEvent(createKeyboardEvent('keydown', 'c', true));
			expect(mockClipboard.writeText).toHaveBeenCalledWith(selectedText);
		});

		it('should not write to clipboard if no content is selected', () => {
			expect(selectToolApi.getActiveSession()).toBeNull();
			document.dispatchEvent(createKeyboardEvent('keydown', 'c', true));
			expect(mockClipboard.writeText).not.toHaveBeenCalled();
		});
	});

	describe('Cut Behavior (Ctrl+X)', () => {
		it('should write selected text to clipboard, cancel selection, and request render when content is selected', async () => {
			const selectedText = 'Cut This';
			simulateSelection(selectedText);
			expect(selectToolApi.getActiveSession()?.getSelectedContent()?.data).toBe(selectedText);

			document.dispatchEvent(createKeyboardEvent('keydown', 'x', true));

			expect(mockClipboard.writeText).toHaveBeenCalledWith(selectedText);
			expect(selectToolApi.getActiveSession()).toBeNull();
		});

		it('should not act if no content is selected', () => {
			expect(selectToolApi.getActiveSession()).toBeNull();
			document.dispatchEvent(createKeyboardEvent('keydown', 'x', true));

			expect(mockClipboard.writeText).not.toHaveBeenCalled();
		});
	});

	describe('Paste Behavior (Ctrl+V)', () => {
		it('should do nothing if clipboard is empty', async () => {
			mockClipboardData.text = '';

			document.dispatchEvent(createKeyboardEvent('keydown', 'v', true));
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(selectToolApi.getActiveSession()).toBeNull();
		});

		it('should do nothing if clipboard read fails (simulated by rejecting promise)', async () => {
			document.dispatchEvent(createKeyboardEvent('keydown', 'v', true));
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(selectToolApi.getActiveSession()).toBeNull();
		});

		it('should create a selection with clipboard text at mouse position, and activate select tool', async () => {
			const clipboardText = 'Pasted\nText';
			mockClipboardData.text = clipboardText;

			const mouseEvent = createMouseEvent('mousemove', 100, 150);
			window.dispatchEvent(mouseEvent);

			document.dispatchEvent(createKeyboardEvent('keydown', 'v', true));
			await new Promise((resolve) => setImmediate(resolve));

			const activeSession = selectToolApi.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.getSelectedContent()?.data).toBe(clipboardText);

			const { x: cellX, y: cellY } = clipboardTool['getCellPos'](
				mouseEvent.clientX,
				mouseEvent.clientY
			);
			expect(activeSession?.getSelectedContent()?.region.startX).toBe(cellX);
			expect(activeSession?.getSelectedContent()?.region.startY).toBe(cellY);

			expect(toolManager.getActiveToolName()).toBe('select');
		});
	});

	describe('Mouse Position Tracking', () => {
		it('should update internal mouse position on mouse move', () => {
			const clientX = 250;
			const clientY = 350;
			window.dispatchEvent(createMouseEvent('mousemove', clientX, clientY));
			expect(clipboardTool['mousePosition']).toEqual({ x: clientX, y: clientY });
		});
	});
});
