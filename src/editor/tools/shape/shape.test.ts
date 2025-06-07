import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core } from '@editor/core';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import { DrawShapeTool } from './shape-draw-tool';
import { SelectTool, type SelectToolApi } from '../select/select-tool';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import type { ToolManager } from '@editor/tool-manager';
import type { HistoryManager } from '@editor/history-manager';

vi.mock('canvaskit-wasm', () => cvk);

const createMouseEvent = (
	type: string,
	clientX: number,
	clientY: number,
	buttons: number = 1
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, buttons }) as MouseEvent;
};

describe('Draw Shape Tool', () => {
	let core: Core;
	let drawShapeTool: DrawShapeTool;
	let selectTool: SelectTool;
	let camera: Camera;
	let toolManager: ToolManager;
	let historyManager: HistoryManager;

	beforeEach(() => {
		const busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		camera = new Camera(1200, 1200);

		const [_core, _app] = createAppInstance({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			canvasKitInstance: cvk.CanvasKit as any,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			busManager: busManager,
			camera: camera,
			font: { buffer: new ArrayBuffer(8), family: '' }
		});

		core = _core;
		historyManager = core.getHistoryManager();
		selectTool = new SelectTool(core);
		_app.registerTool(selectTool);

		drawShapeTool = new DrawShapeTool(core);
		_app.registerTool(drawShapeTool);

		toolManager = _core.getToolManager();
		toolManager.setDefaultTool(drawShapeTool);

		const fontManager = core.getFontManager();
		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	afterEach(() => {
		core.getToolManager().activateTool(drawShapeTool.name);
	});

	const cellToWorld = (cellX: number, cellY: number) => {
		const fontMetrics = core.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	};

	const performShapeDraw = (
		startCellX: number,
		startCellY: number,
		endCellX: number,
		endCellY: number,
		button: number = 1
	) => {
		const startClientCoords = cellToWorld(startCellX, startCellY);
		const endClientCoords = cellToWorld(endCellX, endCellY);
		const selectCanvasElement = core.getCanvases().select.canvas;
		selectCanvasElement.dispatchEvent(
			createMouseEvent('mousedown', startClientCoords.x, startClientCoords.y, button)
		);
		window.dispatchEvent(
			createMouseEvent('mousemove', endClientCoords.x, endClientCoords.y, button)
		);
		window.dispatchEvent(createMouseEvent('mouseup', endClientCoords.x, endClientCoords.y, button));
	};

	it('should initially be configured to draw a rectangle', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;

		performShapeDraw(0, 0, 5, 5);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe(`┌────┐
│    │
│    │
│    │
│    │
└────┘`);
	});

	it('should draw a complete rectangle (top-left to bottom-right) and activate select tool', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;

		performShapeDraw(0, 0, 5, 3);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe(`┌────┐
│    │
│    │
└────┘`);

		expect(toolManager.getActiveToolName()).toBe('select');
	});

	it('should correctly draw a rectangle when dragging from bottom-right to top-left and activate selectTool', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;

		performShapeDraw(-5, -3, 0, 0);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe(`┌────┐
│    │
│    │
└────┘`);

		expect(toolManager.getActiveToolName()).toBe('select');
	});

	it('should not draw anything if mouse down and up are on the same cell', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;

		performShapeDraw(0, 0, 0, 0);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeNull();

		expect(toolManager.getActiveToolName()).toBe('shape');
	});

	it('should create a horizontal line if mouse is moving only x axis', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
		performShapeDraw(0, 0, 5, 0, 0);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe('──────');
		expect(toolManager.getActiveToolName()).toBe('select');
	});

	it('should create a vertical line if mouse is moving only y axis', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
		performShapeDraw(0, 0, 0, 4, 0);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe(`│
│
│
│
│`);
		expect(toolManager.getActiveToolName()).toBe('select');
	});

	it('should cancel drawing if the active layer becomes invisible during a drag', () => {
		const selectCanvasElement = core.getCanvases().select.canvas;
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
		const layersManager = core.getLayersManager();
		let activeLayer = layersManager.getActiveLayer();
		if (!activeLayer) {
			[, activeLayer] = layersManager.addLayer();
			layersManager.setActiveLayer(activeLayer.id);
		}
		expect(activeLayer?.opts.visible).toBe(true);

		const startClientCoords = cellToWorld(0, 0);
		const midClientCoords = cellToWorld(5, 5);
		const endClientCoords = cellToWorld(5, 5);

		selectCanvasElement.dispatchEvent(
			createMouseEvent('mousedown', startClientCoords.x, startClientCoords.y, 1)
		);

		selectCanvasElement.dispatchEvent(
			createMouseEvent('mousemove', midClientCoords.x, midClientCoords.y, 1)
		);

		layersManager.updateLayer(activeLayer!.id, { ...activeLayer!.opts, opts: { visible: false } });
		expect(layersManager.getActiveLayer()?.opts.visible).toBe(false);

		selectCanvasElement.dispatchEvent(
			createMouseEvent('mouseup', endClientCoords.x, endClientCoords.y, 1)
		);

		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeNull();
		expect(toolManager.getActiveToolName()).toBe('shape');
	});

	it('should not start drawing if the active layer is initially invisible', () => {
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
		const layersManager = core.getLayersManager();
		let activeLayer = layersManager.getActiveLayer();
		if (!activeLayer) {
			const [, newActiveLayer] = layersManager.addLayer();
			activeLayer = newActiveLayer;
			layersManager.setActiveLayer(activeLayer!.id);
		}
		layersManager.updateLayer(activeLayer!.id, { ...activeLayer!.opts, opts: { visible: false } });
		expect(layersManager.getActiveLayer()?.opts.visible).toBe(false);

		performShapeDraw(0, 0, 5, 5, 0);

		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeNull();
		expect(toolManager.getActiveToolName()).toBe('shape');
	});

	it('should ensure a layer exists (creating one if none) before starting to draw when triggered by mouse event', () => {
		const layersManager = core.getLayersManager();
		const initialLayers = layersManager.getLayers();
		initialLayers.forEach((layer) => layersManager.removeLayer(layer.id));

		expect(layersManager.getLayers().length).toBe(0);
		const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
		performShapeDraw(0, 0, 2, 2, 0);

		expect(layersManager.getLayers().length).toBeGreaterThan(0);
		const activeSession = selectToolApi.getActiveSession();
		expect(activeSession).toBeDefined();
		expect(activeSession?.getSelectedContent()?.data).toBe(`┌─┐
│ │
└─┘`);
		expect(toolManager.getActiveToolName()).toBe('select');
	});

	describe('History (Undo/Redo) for Shape Drawing', () => {
		it('should correctly undo and redo a shape drawing operation', () => {
			const selectToolApi = core.getToolManager().getToolApi<SelectToolApi>('select')!;
			const expectedShapeData = `┌──┐
│  │
└──┘`;

			performShapeDraw(1, 1, 4, 3);
			let activeSession = selectToolApi.getActiveSession();
			expect(activeSession).toBeDefined();
			expect(activeSession?.getSelectedContent()?.data).toBe(expectedShapeData);
			expect(toolManager.getActiveToolName()).toBe('select');

			historyManager.undo();
			activeSession = selectToolApi.getActiveSession();
			expect(activeSession).toBeNull();
			expect(toolManager.getActiveToolName()).toBe('select');

			historyManager.redo();
			activeSession = selectToolApi.getActiveSession();
			expect(activeSession).toBeDefined();
			expect(activeSession?.getSelectedContent()?.data).toBe(expectedShapeData);
			expect(toolManager.getActiveToolName()).toBe('select');
		});
	});
});
