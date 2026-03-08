import type { Layer } from '@editor/layers/layer';
import type { LayerController } from '@editor/layers/layer-api';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { TextGridObject } from '@editor/objects/text-grid-object';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import type { CellRectangle } from '@editor/types';

export const findTextSelection = (
	region: CellRectangle,
	textGrid: TextGridObject
): TextSelectionObject | null => {
	const startCol = region.cellX;
	const startRow = region.cellY;
	const width = Math.abs(region.width);
	const height = Math.abs(region.height);

	if (width === 0 || height === 0) return null;

	const selectionText = textGrid.getTileMap().readRegion(startCol, startRow, width, height);
	const boundary = findRectangleAreaInString(selectionText);

	if (boundary) {
		const croppedText = cropContent(selectionText, boundary);
		const bounds = {
			cellX: startCol + boundary.start[0],
			cellY: startRow + boundary.start[1],
			width: boundary.end[0] - boundary.start[0] + 1,
			height: boundary.end[1] - boundary.start[1] + 1
		};
		return new TextSelectionObject(bounds, croppedText);
	}
	return null;
};

export const findRectangleAreaInString = (
	gridString: string
): { start: [number, number]; end: [number, number] } | null => {
	const lines = gridString.split('\n');
	if (lines.length === 0) return null;

	let top = -1,
		left = -1,
		bottom = -1,
		right = -1;
	let foundContent = false;

	for (let r = 0; r < lines.length; r++) {
		for (let c = 0; c < lines[r].length; c++) {
			const ch = lines[r][c];
			if (ch && ch !== ' ') {
				if (!foundContent) {
					top = r;
					left = c;
					bottom = r;
					right = c;
					foundContent = true;
				} else {
					top = Math.min(top, r);
					left = Math.min(left, c);
					bottom = Math.max(bottom, r);
					right = Math.max(right, c);
				}
			}
		}
	}

	return foundContent ? { start: [left, top], end: [right, bottom] } : null;
};

export const cropContent = (
	full: string,
	boundary: { start: [number, number]; end: [number, number] }
) => {
	const rows = full.split('\n');
	const { start, end } = boundary;
	return rows
		.slice(start[1], end[1] + 1)
		.map((row) => row.slice(start[0], end[0] + 1))
		.join('\n');
};

const _findIntersectingObjects = (
	region: CellRectangle,
	layer: Layer | LayerController
): ISmartObject[] => {
	return layer.objects.filter((obj) => {
		if (!obj.capabilities.canSelect || obj.type === 'text-grid') return false;
		return obj.regionHitTest(region) || obj.hitTest(region.cellX, region.cellY);
	});
};

export const findIntersectingObjects = (
	region: CellRectangle,
	layers: (Layer | LayerController | null)[]
): ISmartObject[] => {
	return layers
		.filter((layer) => layer !== null)
		.flatMap((layer) => _findIntersectingObjects(region, layer));
};

export const findObjectsInRegion = (
	region: CellRectangle,
	layer: LayerController,
	tempLayer: LayerController | null
): ISmartObject[] => {
	const isPointSelect = Math.abs(region.width) === 1 && Math.abs(region.height) === 1;

	if (!isPointSelect) {
		const found: ISmartObject[] = [];
		const textGrids = findTextGridObjects(layer, tempLayer);
		for (const textGrid of textGrids) {
			const textSelection = findTextSelection(region, textGrid);
			if (textSelection) found.push(textSelection);
		}
		const otherObjects = findIntersectingObjects(region, [layer, tempLayer]);
		found.push(...otherObjects);
		return found;
	}

	const ordered = layer.getOrderedObjects();
	const { cellX, cellY } = region;
	for (let i = 0; i < ordered.length; i++) {
		const obj = ordered[i];
		if (obj.type === 'text-grid') continue;
		if (!obj.capabilities.canSelect) continue;
		if (obj.hitTest(cellX, cellY) || obj.regionHitTest({ cellX, cellY, width: 1, height: 1 })) {
			return [obj];
		}
	}

	const textGrids = findTextGridObjects(layer, tempLayer);
	for (const textGrid of textGrids) {
		const textSelection = findTextSelection({ cellX, cellY, width: 1, height: 1 }, textGrid);
		if (textSelection) return [textSelection];
	}
	return [];
};

export const findTextGridObjects = (
	...layers: (Layer | LayerController | null)[]
): TextGridObject[] => {
	return layers
		.filter((layer): layer is Layer | LayerController => layer !== null)
		.map((layer) => layer.grid);
};

export const doRectanglesIntersect = (rect1: CellRectangle, rect2: CellRectangle): boolean => {
	const w1 = rect1.width === 0 ? 1 : rect1.width;
	const h1 = rect1.height === 0 ? 1 : rect1.height;
	const w2 = rect2.width === 0 ? 1 : rect2.width;
	const h2 = rect2.height === 0 ? 1 : rect2.height;
	return (
		rect1.cellX < rect2.cellX + w2 &&
		rect1.cellX + w1 > rect2.cellX &&
		rect1.cellY < rect2.cellY + h2 &&
		rect1.cellY + h1 > rect2.cellY
	);
};
