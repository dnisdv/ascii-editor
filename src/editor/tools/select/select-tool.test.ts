import type { Core } from '@editor/core';
import type { SelectionModeContext } from './modes/selection-mode-ctx';
import type { SelectionSessionManager } from './session/selection-session-manager';
import type { ILayer } from '@editor/types';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SelectTool } from './select-tool';
import { SelectionModeName } from './modes/modes.type';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';

import * as cvk from '@editor/__mock__/canvaskit-wasm';

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

const RABBIT_DRAWING_ROTATED_90 = `-|||      
- xx-|||||
- xx-    -
-   -|||||
-V  -     
-   -     
-   -     
- xx-|||||
- xx-    -
-   -|||||
-|||      `;

const RABBIT_DRAWING_ROTATED_180 = `-----------
|     V   |
| xx    xx|
| xx    xx|
 --------- 
 | |   | | 
 | |   | | 
 | |   | | 
 | |   | | 
 |-|   |-| `;

const RABBIT_DRAWING_ROTATED_270 = `      |||-
|||||-   -
-    -xx -
|||||-xx -
     -   -
     -   -
     -  V-
|||||-   -
-    -xx -
|||||-xx -
      |||-`;

const DRAWING_WIDTH_CELLS = 11;
const DRAWING_HEIGHT_CELLS = 10;

const DRAWING_ORIGINAL_WIDTH_CELLS = 11;
const DRAWING_ORIGINAL_HEIGHT_CELLS = 10;

describe('SelectTool', () => {
	let selectTool: SelectTool;
	let core: Core;
	let modeContext: SelectionModeContext;
	let selectionSessionManager: SelectionSessionManager;

	beforeEach(() => {
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

		_app.registerTool(new SelectTool(_core));
		selectTool = _app.getToolManager().getTool('select') as SelectTool;

		const toolManager = _core.getToolManager();
		toolManager.setDefaultTool(selectTool);

		modeContext = selectTool['modeContext'];
		selectionSessionManager = selectTool['selectionSessionManager'];

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

	const setupLayerWithDrawing = (drawing: string, cellX: number = 0, cellY: number = 0): ILayer => {
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

	const resetSelect = () => {
		performSelectionDrag(-999, -999, -999, -999);
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
		expect(selectionSessionManager.getActiveSession()?.isEmpty()).toBe(false);
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
		const selectedContent = selectionSessionManager.getActiveSession()?.getSelectedContent();
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

		const selectedContent = selectionSessionManager.getActiveSession()?.getSelectedContent();
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

		it('should transition SELECTED -> ROTATING -> SELECTED on clicking a rotation handle and dragging', () => {
			const rotationHandleClientX = -10;
			const rotationHandleClientY = -18;

			modeContext.onMouseMove(
				createMouseEvent('mousemove', rotationHandleClientX, rotationHandleClientY)
			);

			modeContext.onMouseDown(
				createMouseEvent('mousedown', rotationHandleClientX, rotationHandleClientY)
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.ROTATING);

			modeContext.onMouseMove(
				createMouseEvent('mousemove', rotationHandleClientX + 20, rotationHandleClientY + 20)
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.ROTATING);

			modeContext.onMouseUp(
				createMouseEvent('mouseup', rotationHandleClientX + 20, rotationHandleClientY + 20)
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		});

		it('should transition SELECTED -> ROTATING -> SELECTED, updating region and content on mouse move around center (90deg snaps)', () => {
			const initialSelectionData = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(initialSelectionData?.data).toEqual(RABBIT_DRAWING);

			const initialCellRegion = {
				startX: initialCellStartX,
				startY: initialCellStartY,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			};
			expect(initialSelectionData?.region).toEqual(initialCellRegion);

			const initialSelectedWorldRegion = {
				...selectionSessionManager.getActiveSession()!.getSelectedRegion()!
			};
			const handleOffset = 2;

			const mouseDownWorldHandlePos = {
				x: initialSelectedWorldRegion.startX + initialSelectedWorldRegion.width + handleOffset,
				y: initialSelectedWorldRegion.startY - handleOffset
			};
			const mouseDownScreenPos = core
				.getCamera()
				.worldToScreen(mouseDownWorldHandlePos.x, mouseDownWorldHandlePos.y);
			modeContext.onMouseDown(
				createMouseEvent('mousedown', mouseDownScreenPos.x, mouseDownScreenPos.y)
			);

			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.ROTATING);
			let currentSelection = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(currentSelection?.data, 'Content should not change on mousedown').toEqual(
				RABBIT_DRAWING
			);
			expect(currentSelection?.region, 'Region should not change on mousedown').toEqual(
				initialCellRegion
			);

			const worldPivotX = initialSelectedWorldRegion.startX + initialSelectedWorldRegion.width / 2;
			const worldPivotY = initialSelectedWorldRegion.startY + initialSelectedWorldRegion.height / 2;

			const radius =
				Math.max(initialSelectedWorldRegion.width, initialSelectedWorldRegion.height) * 0.6;

			const getScreenPosForAngle = (degrees: number) => {
				const radians = degrees * (Math.PI / 180);
				const targetWorldX = worldPivotX + radius * Math.cos(radians);
				const targetWorldY = worldPivotY + radius * Math.sin(radians);
				return core.getCamera().worldToScreen(targetWorldX, targetWorldY);
			};

			const cellRegionPivotX = initialCellRegion.startX + initialCellRegion.width / 2;
			const cellRegionPivotY = initialCellRegion.startY + initialCellRegion.height / 2;

			const rotationTestSequence = [
				{
					targetAngleDegrees: 0,
					expectedArt: RABBIT_DRAWING,
					expectedCellRegion: {
						startX: Math.floor(cellRegionPivotX - DRAWING_ORIGINAL_WIDTH_CELLS / 2),
						startY: Math.floor(cellRegionPivotY - DRAWING_ORIGINAL_HEIGHT_CELLS / 2),
						width: DRAWING_ORIGINAL_WIDTH_CELLS,
						height: DRAWING_ORIGINAL_HEIGHT_CELLS
					}
				},
				{
					targetAngleDegrees: 90,
					expectedArt: RABBIT_DRAWING_ROTATED_90,
					expectedCellRegion: {
						startX: Math.floor(cellRegionPivotX - DRAWING_ORIGINAL_HEIGHT_CELLS / 2),
						startY: Math.floor(cellRegionPivotY - DRAWING_ORIGINAL_WIDTH_CELLS / 2),
						width: DRAWING_ORIGINAL_HEIGHT_CELLS,
						height: DRAWING_ORIGINAL_WIDTH_CELLS
					}
				},
				{
					targetAngleDegrees: 180,
					expectedArt: RABBIT_DRAWING_ROTATED_180,
					expectedCellRegion: {
						startX: Math.floor(cellRegionPivotX - DRAWING_ORIGINAL_WIDTH_CELLS / 2),
						startY: Math.floor(cellRegionPivotY - DRAWING_ORIGINAL_HEIGHT_CELLS / 2),
						width: DRAWING_ORIGINAL_WIDTH_CELLS,
						height: DRAWING_ORIGINAL_HEIGHT_CELLS
					}
				},
				{
					targetAngleDegrees: 270,
					expectedArt: RABBIT_DRAWING_ROTATED_270,
					expectedCellRegion: {
						startX: Math.floor(cellRegionPivotX - DRAWING_ORIGINAL_HEIGHT_CELLS / 2),
						startY: Math.floor(cellRegionPivotY - DRAWING_ORIGINAL_WIDTH_CELLS / 2),
						width: DRAWING_ORIGINAL_HEIGHT_CELLS,
						height: DRAWING_ORIGINAL_WIDTH_CELLS
					}
				}
			];

			let lastScreenTarget = mouseDownScreenPos;

			for (const testCase of rotationTestSequence) {
				const targetScreenPos = getScreenPosForAngle(testCase.targetAngleDegrees);
				modeContext.onMouseMove(
					createMouseEvent('mousemove', targetScreenPos.x, targetScreenPos.y)
				);

				expect(
					modeContext.getCurrentModeName(),
					`Mode check for target angle ${testCase.targetAngleDegrees}deg`
				).toBe(SelectionModeName.ROTATING);
				currentSelection = selectionSessionManager.getActiveSession()?.getSelectedContent();
				expect(currentSelection?.data).toEqual(testCase.expectedArt);
				expect(currentSelection?.region).toEqual(testCase.expectedCellRegion);

				lastScreenTarget = targetScreenPos;
			}

			modeContext.onMouseUp(createMouseEvent('mouseup', lastScreenTarget.x, lastScreenTarget.y));
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
		});

		it('should transition SELECTED -> SELECTING -> IDLE if try to rotate only with one char selected', () => {
			resetSelect();
			performSelectionDrag(1, 1, 1, 1);

			const selectedWorldRegion = selectionSessionManager.getActiveSession()!.getSelectedRegion()!;
			const selectedContent = selectionSessionManager.getActiveSession()?.getSelectedContent()!
				.data;
			expect(selectedContent).toBe('|');

			const handleOffset = 2;
			const righTopScreenCorner = core
				.getCamera()
				.worldToScreen(
					selectedWorldRegion.startX + selectedWorldRegion.width + handleOffset,
					selectedWorldRegion.startY
				);

			modeContext.onMouseDown(
				createMouseEvent('mousedown', righTopScreenCorner.x, righTopScreenCorner.y)
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTING);
		});

		it('should transition SELECTED -> MOVING -> SELECTED when DRAGGING and MOVING the selected content', () => {
			const initialSelection = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(initialSelection?.region.startX).toBe(0);
			expect(initialSelection?.region.startY).toBe(0);

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

			const finalSelection = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(finalSelection?.region.startX).toBe(0 + moveOffsetCells.x);
			expect(finalSelection?.region.startY).toBe(0 + moveOffsetCells.y);
			expect(finalSelection?.region.width).toBe(DRAWING_WIDTH_CELLS);
			expect(finalSelection?.region.height).toBe(DRAWING_HEIGHT_CELLS);
			expect(finalSelection?.data).toEqual(RABBIT_DRAWING);
		});

		it('should transition SELECTED -> SELECTING -> IDLE when clicking outside and DRAGGING on an EMPTY area', () => {
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			expect(selectionSessionManager.getActiveSession()?.isEmpty()).toBe(false);

			performSelectionDrag(100, 100, 110, 110);

			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
			expect(selectionSessionManager.getActiveSession()?.isEmpty()).toBe(true);
		});

		it('should transition SELECTED -> SELECTING -> SELECTED when clicking outside and selecting new content', () => {
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			const oldSelection = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(oldSelection?.region.startX).toBe(0);

			const newDrawing = 'NEW';
			setupLayerWithDrawing(newDrawing, 50, 50);

			performSelectionDrag(50, 50, 50 + newDrawing.length - 1, 50);

			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			const newSelectedContent = selectionSessionManager.getActiveSession()?.getSelectedContent();
			expect(newSelectedContent?.data).toEqual(newDrawing);
			expect(newSelectedContent?.region.startX).toBe(50);
		});

		it('should delete selected content correctly', () => {
			let deleteKeyEvent = new KeyboardEvent('keydown', { key: 'Delete' });
			document.dispatchEvent(deleteKeyEvent);
			let activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);

			setupLayerWithDrawing(RABBIT_DRAWING, initialCellStartX, initialCellStartY);
			performSelectionDrag(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			deleteKeyEvent = new KeyboardEvent('keydown', { key: 'Delete' });
			document.dispatchEvent(deleteKeyEvent);
			activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);
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
			const activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).not.toBe(null);
		});

		it('should commit selected to source layer on active layer change', () => {
			const activeLayer = core.getLayersManager().getActiveLayer()!;
			core.getLayersManager().addLayer();

			const activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);

			const selectedContent = activeLayer.readRegion(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(selectedContent).toBe(RABBIT_DRAWING);
		});

		it('should commit selected to source layer on active layer update visibility', () => {
			const activeLayer = core.getLayersManager().getActiveLayer()!;
			core.getLayersManager().updateLayer(activeLayer.id, { opts: { visible: false } });

			const activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);

			const selectedContent = activeLayer.readRegion(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(selectedContent).toBe(RABBIT_DRAWING);
		});

		it('should commit selected to source layer on page unload', () => {
			const unloadEvent = new Event('beforeunload');
			window.dispatchEvent(unloadEvent);

			const activeLayer = core.getLayersManager().getActiveLayer()!;
			const selectedContent = activeLayer.readRegion(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(selectedContent).toBe(RABBIT_DRAWING);
		});

		it('should allow only IDLE mode and SELECTING mode if select tool not meet requirements', () => {
			const activeLayer = core.getLayersManager().getActiveLayer()!;
			core.getLayersManager().updateLayer(activeLayer.id, { opts: { visible: false } });

			performSelectionDrag(
				initialCellStartX,
				initialCellStartY,
				DRAWING_WIDTH_CELLS,
				DRAWING_HEIGHT_CELLS
			);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.IDLE);
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

			let activeSession = selectionSessionManager.getActiveSession()!;
			let selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);

			core.getHistoryManager().undo();

			activeSession = selectionSessionManager.getActiveSession()!;
			expect(activeSession).toBe(null);

			core.getHistoryManager().redo();

			activeSession = selectionSessionManager.getActiveSession()!;
			selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
		});

		it('Undo/Redo Move Selection', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS, DRAWING_HEIGHT_CELLS);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			let activeSession = selectionSessionManager.getActiveSession()!;
			let selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
			expect(selectedContent.region).toStrictEqual({
				startX: 0,
				startY: 0,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			performDrag(2, 2, 4, 4);

			activeSession = selectionSessionManager.getActiveSession()!;
			selectedContent = activeSession.getSelectedContent()!;

			expect(selectedContent.region).toStrictEqual({
				startX: 2,
				startY: 2,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			core.getHistoryManager().undo();

			activeSession = selectionSessionManager.getActiveSession()!;
			selectedContent = activeSession.getSelectedContent()!;

			expect(selectedContent.data).toEqual(RABBIT_DRAWING);
			expect(selectedContent.region).toStrictEqual({
				startX: 0,
				startY: 0,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});

			core.getHistoryManager().redo();

			activeSession = selectionSessionManager.getActiveSession()!;
			selectedContent = activeSession.getSelectedContent()!;

			expect(selectedContent.region).toStrictEqual({
				startX: 2,
				startY: 2,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			});
		});

		it('Undo/Redo Rotation', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS - 1, DRAWING_HEIGHT_CELLS - 1);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			let activeSession = selectionSessionManager.getActiveSession()!;
			let selectedContent = activeSession.getSelectedContent()!;
			const initialArt = RABBIT_DRAWING;
			const initialCellRegion = {
				startX: 0,
				startY: 0,
				width: DRAWING_ORIGINAL_WIDTH_CELLS,
				height: DRAWING_ORIGINAL_HEIGHT_CELLS
			};
			expect(selectedContent.data).toEqual(initialArt);
			expect(selectedContent.region).toEqual(initialCellRegion);
			expect(selectedContent.region.width).toBe(DRAWING_WIDTH_CELLS);
			expect(selectedContent.region.height).toBe(DRAWING_HEIGHT_CELLS);

			const initialSelectedWorldRegion = {
				...selectionSessionManager.getActiveSession()!.getSelectedRegion()!
			};

			const handleOffset = 2;
			const mouseDownWorldHandlePos = {
				x: initialSelectedWorldRegion.startX + initialSelectedWorldRegion.width + handleOffset,
				y: initialSelectedWorldRegion.startY - handleOffset
			};
			const mouseDownScreenPos = core
				.getCamera()
				.worldToScreen(mouseDownWorldHandlePos.x, mouseDownWorldHandlePos.y);

			const worldPivotX = initialSelectedWorldRegion.startX + initialSelectedWorldRegion.width / 2;
			const worldPivotY = initialSelectedWorldRegion.startY + initialSelectedWorldRegion.height / 2;
			const radius =
				Math.max(initialSelectedWorldRegion.width, initialSelectedWorldRegion.height) * 0.6;
			const getScreenPosForAngle = (degrees: number) => {
				const radians = degrees * (Math.PI / 180);
				const targetWorldX = worldPivotX + radius * Math.cos(radians);
				const targetWorldY = worldPivotY + radius * Math.sin(radians);
				return core.getCamera().worldToScreen(targetWorldX, targetWorldY);
			};

			modeContext.onMouseMove(
				createMouseEvent('mousemove', mouseDownScreenPos.x, mouseDownScreenPos.y, 0)
			);

			modeContext.onMouseDown(
				createMouseEvent('mousedown', mouseDownScreenPos.x, mouseDownScreenPos.y)
			);
			expect(modeContext.getCurrentModeName(), 'Mode after mousedown on handle').toBe(
				SelectionModeName.ROTATING
			);

			const screenPosFor90Deg = getScreenPosForAngle(90);
			modeContext.onMouseMove(
				createMouseEvent('mousemove', screenPosFor90Deg.x, screenPosFor90Deg.y)
			);

			const cellRegionPivotX = initialCellRegion.startX + initialCellRegion.width / 2;
			const cellRegionPivotY = initialCellRegion.startY + initialCellRegion.height / 2;
			const expectedArt90 = RABBIT_DRAWING_ROTATED_90;
			const expectedCellRegion90 = {
				startX: Math.floor(cellRegionPivotX - DRAWING_ORIGINAL_HEIGHT_CELLS / 2),
				startY: Math.floor(cellRegionPivotY - DRAWING_ORIGINAL_WIDTH_CELLS / 2),
				width: DRAWING_ORIGINAL_HEIGHT_CELLS,
				height: DRAWING_ORIGINAL_WIDTH_CELLS
			};

			selectedContent = selectionSessionManager.getActiveSession()!.getSelectedContent()!;
			expect(selectedContent.data).toEqual(expectedArt90);
			expect(selectedContent.region).toEqual(expectedCellRegion90);

			modeContext.onMouseUp(createMouseEvent('mouseup', screenPosFor90Deg.x, screenPosFor90Deg.y));
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			selectedContent = selectionSessionManager.getActiveSession()!.getSelectedContent()!;
			expect(selectedContent.data).toEqual(expectedArt90);
			expect(selectedContent.region).toEqual(expectedCellRegion90);

			core.getHistoryManager().undo();
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			activeSession = selectionSessionManager.getActiveSession()!;
			expect(activeSession).not.toBeNull();

			selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(initialArt);
			expect(selectedContent.region).toEqual(initialCellRegion);

			core.getHistoryManager().redo();
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);
			activeSession = selectionSessionManager.getActiveSession()!;
			expect(activeSession).not.toBeNull();

			selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(expectedArt90);
			expect(selectedContent.region).toEqual(expectedCellRegion90);
		});

		it('Undo/Redo Commit (e.g., via deselect or layer change)', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS - 1, DRAWING_HEIGHT_CELLS - 1);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			let activeSession = selectionSessionManager.getActiveSession()!;
			let selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);

			const commitKey = new KeyboardEvent('keydown', { key: 'Escape' });
			document.dispatchEvent(commitKey);

			activeSession = selectionSessionManager.getActiveSession()!;
			expect(activeSession).toBe(null);

			core.getHistoryManager().undo();

			activeSession = selectionSessionManager.getActiveSession()!;
			selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);

			core.getHistoryManager().redo();

			activeSession = selectionSessionManager.getActiveSession()!;
			expect(activeSession).toBe(null);
		});

		it('Undo/Redo Cancel (e.g., via delete key)', () => {
			setupLayerWithDrawing(RABBIT_DRAWING, 0, 0);
			performSelectionDrag(0, 0, DRAWING_WIDTH_CELLS - 1, DRAWING_HEIGHT_CELLS - 1);
			expect(modeContext.getCurrentModeName()).toBe(SelectionModeName.SELECTED);

			const deleteKeyEvent = new KeyboardEvent('keydown', { key: 'Delete' });
			document.dispatchEvent(deleteKeyEvent);
			let activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);

			core.getHistoryManager().undo();

			activeSession = selectionSessionManager.getActiveSession()!;
			const selectedContent = activeSession.getSelectedContent()!;
			expect(selectedContent.data).toEqual(RABBIT_DRAWING);

			core.getHistoryManager().redo();

			activeSession = selectionSessionManager.getActiveSession();
			expect(activeSession).toBe(null);
		});
	});

	// TODO: TEST EXPORTING API
});
