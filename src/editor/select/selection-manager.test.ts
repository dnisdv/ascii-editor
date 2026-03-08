import { describe, beforeEach, vi, afterEach, it, expect } from 'vitest';
import { createAppInstance } from '@editor/app';

import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import { SelectionManager } from './selection-manager';
import type { Core } from '@editor/core';
import { LayerController } from '@editor/layers/layer-api';
import type { CellRectangle } from '@editor/types';
import { SelectionMode } from './selection-mode';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import { MockSmartObject } from '@editor/__mock__/smart-object';

vi.mock('canvaskit-wasm', () => cvk);

const TEST_DRAWING = `X...X
.X.X.
..X..
.X.X.
X...X`;

const TEST_DRAWING3x5 = `X..
.X.
..X
.X.
X..`;

const TEST_DRAWING3x3 = `X..
.X.
..X`;

const TEST_DRAWING2x2 = `X.
.X`;

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

const RABBIT_DRAWING_WIDTH_CELLS = 11;
const RABBIT_DRAWING_HEIGHT_CELLS = 10;

describe('Selection System Integration Tests', () => {
	let core: Core;
	let selectionManager: SelectionManager;
	let activeLayer: LayerController;

	beforeEach(() => {
		const camera = new Camera(1200, 800);
		const canvasKitInstance = cvk.CanvasKit;
		const appFontData = { buffer: new ArrayBuffer(8), family: 'Test' };

		const [_core] = createAppInstance({
			canvasKitInstance,
			gridCanvasElement: document.createElement('canvas'),
			selectCanvasElement: document.createElement('canvas'),
			asciiCanvasElement: document.createElement('canvas'),
			camera,
			font: appFontData
		});
		core = _core;

		selectionManager = core.getSelectionManager();

		vi.spyOn(core.getFontManager(), 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Text selection', () => {
		beforeEach(() => {
			activeLayer = core.getLayersManager().ensureLayer();
			activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);
		});

		it('should select a region and create an active session', () => {
			const region: CellRectangle = { cellX: 0, cellY: 0, width: 3, height: 3 };
			const selectionMade = selectionManager.selectRegion(region, SelectionMode.SET);
			expect(selectionMade).toBe(true);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			const textSelectionObject =
				activeSession?.getSelectedObjects()[0] as unknown as TextSelectionObject;
			expect(textSelectionObject.getProperty('transform.x')).toBe(0);
			expect(textSelectionObject.getProperty('transform.y')).toBe(0);
			expect(textSelectionObject.getProperty('transform.width')).toBe(3);
			expect(textSelectionObject.getProperty('transform.height')).toBe(3);
			expect(textSelectionObject.selectedText).toBe(TEST_DRAWING3x3);
		});

		it('should not expose text-selection object in real layer objects list', () => {
			const region: CellRectangle = { cellX: 0, cellY: 0, width: 3, height: 3 };
			selectionManager.selectRegion(region, SelectionMode.SET);

			const session = selectionManager.getActiveSession();
			expect(session).not.toBeNull();
			const selected = session!.getSelectedObjects();
			expect(selected.length).toBe(1);
			expect(selected[0].type).toBe('text-selection');

			const layerObjects = activeLayer.getObjects();
			expect(layerObjects.some((o) => o.type === 'text-selection')).toBe(false);
		});

		it('should discard previous selection on selection of another region', () => {
			const region: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			const selectionMade = selectionManager.selectRegion(region, SelectionMode.SET);
			expect(selectionMade).toBe(true);

			const region2: CellRectangle = { cellX: 0, cellY: 0, width: 3, height: 3 };
			const selectionMade2 = selectionManager.selectRegion(region2, SelectionMode.SET);
			expect(selectionMade2).toBe(true);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(1);

			const textSelectionObject =
				activeSession?.getSelectedObjects()[0] as unknown as TextSelectionObject;
			expect(textSelectionObject.selectedText).toBe(TEST_DRAWING3x3);
		});

		it('should add to an existing selection when using ADD mode', () => {
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 1, height: 2 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const additionalRegion: CellRectangle = { cellX: 1, cellY: 0, width: 1, height: 2 };
			selectionManager.selectRegion(additionalRegion, SelectionMode.ADD);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(2);
		});

		it('should add to an existing selection when using multiple ADD modes', () => {
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 1, height: 1 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const additionalRegion: CellRectangle = { cellX: 0, cellY: 1, width: 1, height: 4 };
			selectionManager.selectRegion(additionalRegion, SelectionMode.ADD);

			const additionalRegion2: CellRectangle = { cellX: 2, cellY: 0, width: 4, height: 4 };
			selectionManager.selectRegion(additionalRegion2, SelectionMode.ADD);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(3);
		});

		it('should subtract from an existing selection when using SUBTRACT mode', () => {
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const subtractRegion: CellRectangle = { cellX: 3, cellY: 0, width: 2, height: 5 };
			selectionManager.selectRegion(subtractRegion, SelectionMode.SUBTRACT);

			const activeSession = selectionManager.getActiveSession();

			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(1);

			const textSelectionObject =
				activeSession?.getSelectedObjects()[0] as unknown as TextSelectionObject;

			expect(textSelectionObject.getProperty('transform.x')).toBe(0);
			expect(textSelectionObject.getProperty('transform.y')).toBe(0);
			expect(textSelectionObject.getProperty('transform.width')).toBe(3);
			expect(textSelectionObject.getProperty('transform.height')).toBe(5);
			expect(textSelectionObject.selectedText).toBe(TEST_DRAWING3x5);
		});

		it('should subtract from an existing selection when using multiple SUBTRACT modes', () => {
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const subtractRegion: CellRectangle = { cellX: 2, cellY: 0, width: 4, height: 5 };
			selectionManager.selectRegion(subtractRegion, SelectionMode.SUBTRACT);

			const subtractRegion2: CellRectangle = { cellX: 0, cellY: 2, width: 4, height: 4 };
			selectionManager.selectRegion(subtractRegion2, SelectionMode.SUBTRACT);

			const activeSession = selectionManager.getActiveSession();

			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(1);

			const textSelectionObject =
				activeSession?.getSelectedObjects()[0] as unknown as TextSelectionObject;
			expect(textSelectionObject.getProperty('transform.x')).toBe(0);
			expect(textSelectionObject.getProperty('transform.y')).toBe(0);
			expect(textSelectionObject.getProperty('transform.width')).toBe(2);
			expect(textSelectionObject.getProperty('transform.height')).toBe(2);
			expect(textSelectionObject.selectedText).toBe(TEST_DRAWING2x2);
		});

		it('should move an existing selection', () => {
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);
			selectionManager.moveSelection(3, 3);

			expect(selectionManager.getActiveSession()?.getSelectedObjects().length).toBe(1);
			const textSelectionObject = selectionManager
				.getActiveSession()
				?.getSelectedObjects()[0] as unknown as TextSelectionObject;
			expect(textSelectionObject.getProperty('transform.x')).toBe(3);
			expect(textSelectionObject.getProperty('transform.y')).toBe(3);
		});
	});

	describe('smart object selection', () => {
		beforeEach(() => {
			activeLayer = core.getLayersManager().ensureLayer();
		});

		it('should select smart object by creating a new selection session and overriding latest', () => {
			activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);

			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const smartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
			selectionManager.selectSmartObjects([smartObject]);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(1);

			const selectedObject = activeSession?.getSelectedObjects()[0];

			expect(selectedObject?.type).toBe(MockSmartObject.type);
		});

		it('should append smart objects to an existing selection session', () => {
			activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);

			const smartObject = new TextSelectionObject(
				{
					cellX: 0,
					cellY: 0,
					width: RABBIT_DRAWING_WIDTH_CELLS,
					height: RABBIT_DRAWING_HEIGHT_CELLS
				},
				RABBIT_DRAWING
			);
			selectionManager.appendSmartObjects([smartObject]);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.isEmpty()).toBe(false);
			expect(activeSession?.getSelectedObjects().length).toBe(1);
		});

		it('should remove smart objects from an existing selection', () => {
			const smartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 5, height: 5 });
			selectionManager.appendSmartObjects([smartObject]);

			const activeSession = selectionManager.getActiveSession();
			expect(activeSession).not.toBeNull();
			expect(activeSession?.getSelectedObjects().length).toBe(1);

			selectionManager.removeSmartObjects([smartObject.id]);
		});

		it('should select smart object by region', () => {
			const smartObject = new MockSmartObject({ cellX: 5, cellY: 5, width: 5, height: 5 });
			smartObject.hitTest = vi.fn().mockReturnValue(true);
			smartObject.regionHitTest = vi.fn().mockReturnValue(true);

			activeLayer.addObject(smartObject);

			selectionManager.selectRegion(
				{ cellX: 0, cellY: 0, width: 10, height: 10 },
				SelectionMode.SET
			);
			expect(selectionManager.getActiveSession()?.getSelectedObjects().length).toBe(1);

			const selectedObject = selectionManager.getActiveSession()?.getSelectedObjects()[0];
			expect(selectedObject?.type).toBe(MockSmartObject.type);
		});

		it('should append text selection by region', () => {
			activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);
			const initialRegion: CellRectangle = { cellX: 0, cellY: 0, width: 5, height: 5 };
			selectionManager.selectRegion(initialRegion, SelectionMode.SET);

			const additionalRegion: CellRectangle = { cellX: 0, cellY: 0, width: 3, height: 3 };
			selectionManager.selectRegion(additionalRegion, SelectionMode.ADD);

			const selectedObject = selectionManager.getActiveSession()?.getSelectedObjects()[0];
			expect(selectedObject?.type).toBe('text-selection');
		});

		it('should move smart objects', () => {
			const smartObject = new MockSmartObject({ cellX: 5, cellY: 5, width: 5, height: 5 });
			selectionManager.selectSmartObjects([smartObject]);

			selectionManager.moveSelection(10, -5);

			const selectedObject = selectionManager.getActiveSession()?.getSelectedObjects()[0];
			expect(selectedObject?.getProperty('transform.x')).toBe(15);
			expect(selectedObject?.getProperty('transform.y')).toBe(0);
		});

		it('should resize smart objects', () => {
			const smartObject = new MockSmartObject({ cellX: 5, cellY: 5, width: 10, height: 10 });
			selectionManager.selectSmartObjects([smartObject]);

			selectionManager.resizeSelection({ dw: 20, dh: 30, dx: 0, dy: 0 });

			const selectedObject = selectionManager.getActiveSession()?.getSelectedObjects()[0];
			expect(selectedObject?.getProperty('transform.width')).toBe(30);
			expect(selectedObject?.getProperty('transform.height')).toBe(40);
		});
	});

	it('should commit the selection to the grid', () => {
		activeLayer = core.getLayersManager().ensureLayer();
		activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);

		const initialRegion: CellRectangle = { cellX: 1, cellY: 1, width: 2, height: 2 };
		selectionManager.selectRegion(initialRegion, SelectionMode.SET);
		selectionManager.moveSelection(1, 1);

		selectionManager.commitSelection();

		const newGridContent = activeLayer.grid.readRegion(2, 2, 2, 2);
		expect(newGridContent).toBe('X.\n.X');
	});

	it('auto-commits session on active layer change (text selection)', () => {
		activeLayer = core.getLayersManager().ensureLayer();
		activeLayer.grid.setToRegion(0, 0, TEST_DRAWING);

		const region: CellRectangle = { cellX: 1, cellY: 1, width: 2, height: 2 };
		selectionManager.selectRegion(region, SelectionMode.SET);
		selectionManager.moveSelection(1, 1);

		const [newLayerId] = core.getLayersManager().addLayer();
		expect(core.getLayersManager().getActiveLayer()?.id).toBe(newLayerId);

		expect(selectionManager.getActiveSession()).toBeNull();
		const stamped = activeLayer.grid.readRegion(2, 2, 2, 2);
		expect(stamped).toBe('X.\n.X');
	});

	it('auto-commits session on active layer change (smart object)', () => {
		activeLayer = core.getLayersManager().ensureLayer();
		const smartObject = new MockSmartObject({ cellX: 0, cellY: 0, width: 2, height: 2 });
		selectionManager.selectSmartObjects([smartObject]);

		const realLayer = core.getLayersManager().getRealLayer(activeLayer.id)!;
		expect(realLayer.getObjectById(smartObject.id)).toBeUndefined();
		expect(selectionManager.getActiveSession()?.getSelectedObjects().length).toBe(1);

		core.getLayersManager().addLayer();

		expect(selectionManager.getActiveSession()).toBeNull();
		expect(
			core.getLayersManager().getRealLayer(activeLayer.id)!.getObjectById(smartObject.id)
		).toBeDefined();
	});
});
