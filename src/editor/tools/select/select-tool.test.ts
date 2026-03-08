import type { Core } from '@editor/core';
import type { SelectionModeContext } from './modes/selection-mode-ctx';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SelectTool } from './select-tool';
import { SelectionModeName } from './modes/modes.type';
import { createAppInstance } from '@editor/app';
import { Camera } from '@editor/camera';

import * as cvk from '@editor/__mock__/canvaskit-wasm';
import type { SelectionManager } from '@editor/select/selection-manager';
import type { SelectionSession } from '@editor/select/session/selection-session';
import type { TextSelectionObject } from '@editor/objects/text-selection-object';

const createMouseEvent = (
	type: string,
	clientX: number,
	clientY: number,
	buttons: number = 1
): MouseEvent => {
	return new MouseEvent(type, { clientX, clientY, buttons }) as MouseEvent;
};

vi.mock('canvaskit-wasm', () => cvk);

const RABBIT_DRAWING = ` |-|   |-| 
 | |   | | 
 | |   | | 
 | |   | | 
 | |   | | 
 --------- 
|xx    xx |
|xx    xx |
|   V     |
-----------`;

const DRAWING_WIDTH_CELLS = 11;
const DRAWING_HEIGHT_CELLS = 10;

const DRAWING_ORIGINAL_WIDTH_CELLS = 11;
const DRAWING_ORIGINAL_HEIGHT_CELLS = 10;

const getSessionContent = (session: SelectionSession) => {
	if (!session) return null;
	const textObj = session.getSelectedObjects().find((obj) => obj.type === 'text-selection');
	return {
		region: session.boundingBox,
		data: textObj ? (textObj as TextSelectionObject).selectedText : null
	};
};

describe('SelectTool', () => {
	let selectTool: SelectTool;
	let core: Core;
	let modeContext: SelectionModeContext;
	let selectionManager: SelectionManager;

	beforeEach(() => {
		const arrayBuffer = new ArrayBuffer(8);

		const [_core, _app] = createAppInstance({
			canvasKitInstance: cvk.CanvasKit,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			camera: new Camera(1200, 1200),
			font: { buffer: arrayBuffer, family: '' }
		});

		_app.registerTool(new SelectTool(_core));
		selectTool = _app.getToolManager().getTool('select') as SelectTool;

		const toolManager = _core.getToolManager();
		toolManager.setDefaultTool(selectTool);

		modeContext = selectTool['modeContext'];
		selectionManager = _core.getSelectionManager();

		const fontManager = _core.getFontManager();
		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});

		core = _core;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const performDrag = (
		startCellX: number,
		startCellY: number,
		endCellX: number,
		endCellY: number
	) => {
		const startCoords = cellToWorld(startCellX, startCellY);
		const endCoords = cellToWorld(endCellX, endCellY);
		modeContext.onMouseDown(createMouseEvent('mousedown', startCoords.x, startCoords.y));
		modeContext.onMouseMove(createMouseEvent('mousemove', endCoords.x, endCoords.y));
		modeContext.onMouseUp(createMouseEvent('mouseup', endCoords.x, endCoords.y));
	};

	const setupLayerWithDrawing = (drawing: string, cellX: number = 0, cellY: number = 0) => {
		const layersManager = core.getLayersManager();
		const [, layer] = layersManager.addLayer();
		layer.setToRegion(cellX, cellY, drawing);
		return layer;
	};

	const performSelectionDrag = (
		startCellX: number,
		startCellY: number,
		endCellX: number,
		endCellY: number
	) => {
		const startCoords = cellToWorld(startCellX, startCellY);
		const endCoords = cellToWorld(endCellX, endCellY);

		modeContext.onMouseDown(createMouseEvent('mousedown', startCoords.x, startCoords.y));
		modeContext.onMouseMove(createMouseEvent('mousemove', endCoords.x, endCoords.y));
		modeContext.onMouseUp(createMouseEvent('mouseup', endCoords.x, endCoords.y));
	};

	const cellToWorld = (cellX: number, cellY: number) => {
		const fontMetrics = core.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	};

	it('should be in IDLE mode initially', () => {
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
	});

	it('should transition IDLE -> SELECTING -> IDLE on an empty mouse drag', () => {
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);

		modeContext.onMouseDown(createMouseEvent('mousedown', 10, 10));
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTING);

		modeContext.onMouseMove(createMouseEvent('mousemove', 30, 40));
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTING);

		modeContext.onMouseUp(createMouseEvent('mouseup', 30, 40));
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
	});

	it('should transition IDLE -> SELECTING -> SELECTED when content is selected', () => {
		setupLayerWithDrawing(RABBIT_DRAWING, 5, 5);
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);

		performSelectionDrag(0, 0, 50, 50);

		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		expect(selectionManager.getActiveSession()?.isEmpty()).toBe(false);
	});

	it('should select content inclusively and accurately', () => {
		const drawingToSelect = `AAA
AAA
AAA`;
		const expectedSelectedData = drawingToSelect;
		setupLayerWithDrawing(drawingToSelect, 0, 0);
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);

		performSelectionDrag(0, 0, 2, 2);

		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		const selectedContent = getSessionContent(selectionManager.getActiveSession()!);
		expect(selectedContent?.data).toEqual(expectedSelectedData);
		expect(selectedContent?.region.width).toBe(3);
		expect(selectedContent?.region.height).toBe(3);
	});

	it('should select one symbol', () => {
		const drawingToSelect = `AAA
AAA
AAA`;
		const expectedSelectedData = 'A';
		setupLayerWithDrawing(drawingToSelect, 0, 0);
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);

		const mouseDownCords = cellToWorld(0, 0);
		modeContext.onMouseDown(createMouseEvent('mousedown', mouseDownCords.x, mouseDownCords.y));
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTING);

		modeContext.onMouseUp(createMouseEvent('mouseup', mouseDownCords.x, mouseDownCords.y));
		expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

		const selectedContent = getSessionContent(selectionManager.getActiveSession()!);
		expect(selectedContent?.data).toEqual(expectedSelectedData);
		expect(selectedContent?.region.width).toBe(1);
		expect(selectedContent?.region.height).toBe(1);
	});

	describe('When content is already selected', () => {
		const initialCellStartX = 0;
		const initialCellStartY = 0;

		beforeEach(() => {
			setupLayerWithDrawing(RABBIT_DRAWING, initialCellStartX, initialCellStartY);
			performSelectionDrag(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		});

		it('should transition SELECTED -> MOVING -> SELECTED when DRAGGING and MOVING the selected content', () => {
			const initialSelection = getSessionContent(selectionManager.getActiveSession()!);
			expect(initialSelection?.region.cellX).toBe(0);
			expect(initialSelection?.region.cellY).toBe(0);

			const moveStartCell = { x: 0, y: 0 };
			const moveOffsetCells = { x: 9, y: 10 };

			const startDragPos = cellToWorld(moveStartCell.x, moveStartCell.y);
			const endDragPos = cellToWorld(
				moveStartCell.x + moveOffsetCells.x,
				moveStartCell.y + moveOffsetCells.y
			);

			modeContext.onMouseDown(createMouseEvent('mousedown', startDragPos.x, startDragPos.y));
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.MOVING);

			modeContext.onMouseMove(createMouseEvent('mousemove', endDragPos.x, endDragPos.y));
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.MOVING);

			modeContext.onMouseUp(createMouseEvent('mouseup', endDragPos.x, endDragPos.y));
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			const finalSelection = getSessionContent(selectionManager.getActiveSession()!);
			expect(finalSelection?.region.cellX).toBe(0 + moveOffsetCells.x);
			expect(finalSelection?.region.cellY).toBe(0 + moveOffsetCells.y);
			expect(finalSelection?.region.width).toBe(DRAWING_WIDTH_CELLS);
			expect(finalSelection?.region.height).toBe(DRAWING_HEIGHT_CELLS);
			expect(finalSelection?.data).toEqual(RABBIT_DRAWING);
		});

		it('should transition SELECTED -> SELECTING -> IDLE when clicking outside and DRAGGING on an EMPTY area', () => {
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			expect(selectionManager.getActiveSession()?.isEmpty()).toBe(false);

			performSelectionDrag(100, 100, 110, 110);

			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
			expect(selectionManager.getActiveSession()).toBeNull();
		});

		it('should transition SELECTED -> SELECTING -> SELECTED when clicking outside and selecting new content', () => {
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			const oldSelection = getSessionContent(selectionManager.getActiveSession()!);
			expect(oldSelection?.region.cellX).toBe(0);

			const newDrawing = 'NEW';
			setupLayerWithDrawing(newDrawing, 50, 50);

			performSelectionDrag(50, 50, 50 + newDrawing.length - 1, 50);

			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			const newSelectedContent = getSessionContent(selectionManager.getActiveSession()!);
			expect(newSelectedContent?.data).toEqual(newDrawing);
			expect(newSelectedContent?.region.cellX).toBe(50);
		});
	});

	describe('Tool State', () => {
		const initialCellStartX = 0;
		const initialCellStartY = 0;

		beforeEach(() => {
			setupLayerWithDrawing(RABBIT_DRAWING, initialCellStartX, initialCellStartY);
			performSelectionDrag(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			const activeLayer = core.getLayersManager().getActiveLayer()!;
			const selectedContent = activeLayer.readRegion(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);

			expect(selectedContent.trim().length).toBe(0);
		});

		it('should not commit selected to source layer on select tool deactivate', () => {
			selectTool.deactivate();
			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBe(null);
		});

		it('should allow every modes if select tool meet requirements', () => {
			const activeLayer = core.getLayersManager().getActiveLayer()!;
			core.getLayersManager().updateLayer(activeLayer.id, { opts: { visible: false } });
			core.getLayersManager().updateLayer(activeLayer.id, { opts: { visible: true } });

			performSelectionDrag(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		});
	});

	describe('history', () => {
		it('Undo/Redo Selection Creation', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS, DRAWING_HEIGHT_CELLS);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			let activeSession = selectionManager.getActiveSession()!;
			let selectedContent = getSessionContent(activeSession)!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);

			core.getHistoryManager().undo();

			activeSession = selectionManager.getActiveSession()!;
			expect(activeSession).toBe(null);

			core.getHistoryManager().redo();

			activeSession = selectionManager.getActiveSession()!;
			selectedContent = getSessionContent(activeSession)!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
		});

		it('Undo/Redo Move Selection', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS, DRAWING_HEIGHT_CELLS);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			let activeSession = selectionManager.getActiveSession()!;
			let selectedContent = getSessionContent(activeSession)!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
			expect(selectedContent.region).toStrictEqual({
				cellX: 0,
				cellY: 0,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			performDrag(2, 2, 4, 4);

			activeSession = selectionManager.getActiveSession()!;
			selectedContent = getSessionContent(activeSession)!;

			expect(selectedContent.region).toStrictEqual({
				cellX: 2,
				cellY: 2,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			core.getHistoryManager().undo();

			activeSession = selectionManager.getActiveSession()!;
			selectedContent = getSessionContent(activeSession)!;

			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
			expect(selectedContent.region).toStrictEqual({
				cellX: 0,
				cellY: 0,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			core.getHistoryManager().redo();

			activeSession = selectionManager.getActiveSession()!;
			selectedContent = getSessionContent(activeSession)!;

			expect(selectedContent.region).toStrictEqual({
				cellX: 2,
				cellY: 2,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});
		});
	});
});
