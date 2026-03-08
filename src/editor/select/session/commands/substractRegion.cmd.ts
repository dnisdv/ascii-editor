import type { SelectionSession } from '../selection-session';
import type { ISessionCommand, ISessionCommandDeps } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import {
	sessionSubtractRegion,
	type SubtractedTextContent,
	type ModifiedTextObject
} from '@editor/select/history/session-subtract-region';
import type { CellRectangle } from '@editor/types';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { doRectanglesIntersect, findRectangleAreaInString, cropContent } from './utils';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { HistoryManager } from '@editor/history-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';

type SubtractRegionPayload = {
	region: CellRectangle;
};

type SubtractRegionDeps = {
	layersManager: LayersManager;
	historyManager: HistoryManager;
};

export class SubtractRegionCommand implements ISessionCommand {
	private region: CellRectangle;
	private layersManager: LayersManager;

	constructor(deps: SubtractRegionDeps, region: SubtractRegionPayload['region']) {
		this.layersManager = deps.layersManager;
		this.region = this.normalizeRect(region);
	}

	private normalizeRect(rect: CellRectangle): CellRectangle {
		const x = rect.width < 0 ? rect.cellX + rect.width : rect.cellX;
		const y = rect.height < 0 ? rect.cellY + rect.height : rect.cellY;
		const width = Math.abs(rect.width);
		const height = Math.abs(rect.height);
		return { cellX: x, cellY: y, width, height };
	}

	public execute(
		session: SelectionSession,
		deps: ISessionCommandDeps,
		manager: SelectionSessionManager
	): void {
		void manager;
		const sourceLayer = session.getSourceLayer();
		if (!sourceLayer) return;

		const objectsToSubtract = session.getSelectedObjects().filter((obj) => {
			const objBounds = this.getObjectBounds(obj);
			return doRectanglesIntersect(this.region, objBounds);
		});

		if (objectsToSubtract.length === 0) return;

		const { subtractedTextObjects, subtractedSmartObjects, modifiedTextObjects, addedTextObjects } =
			this.calculateSubtraction(objectsToSubtract);

		deps.historyManager.execute(sessionSubtractRegion, 'select::session', {
			subtractedTextObjects,
			subtractedSmartObjectsIds: subtractedSmartObjects.map((obj) => obj.id),
			modifiedTextObjects,
			addedTextObjects
		});
	}

	private getObjectBounds(obj: ISmartObject): CellRectangle {
		return {
			cellX: obj.getProperty('transform.x')!,
			cellY: obj.getProperty('transform.y')!,
			width: obj.getProperty('transform.width')!,
			height: obj.getProperty('transform.height')!
		};
	}

	private makeGridFromText(text: string): string[][] {
		const lines = text.split('\n');
		return lines.map((line) => line.split(''));
	}

	private computeRemovalWindow(objBounds: CellRectangle, region: CellRectangle) {
		const objEndX = objBounds.cellX + objBounds.width;
		const objEndY = objBounds.cellY + objBounds.height;
		const effH = region.height === 0 ? 1 : region.height;
		let startX: number, endX: number;
		let startY: number, endY: number;

		if (region.width === 0) {
			const sx = Math.max(objBounds.cellX, Math.min(region.cellX, objEndX - 1));
			startX = sx;
			endX = sx + 1;
			startY = objBounds.cellY;
			endY = objEndY;
		} else if (region.height === 0) {
			const sy = Math.max(objBounds.cellY, Math.min(region.cellY, objEndY - 1));
			startY = sy;
			endY = sy + 1;
			startX = objBounds.cellX;
			endX = objEndX;
		} else {
			const effW = region.width;
			startX = Math.max(objBounds.cellX, region.cellX);
			endX = Math.min(objEndX, region.cellX + effW);
			startY = Math.max(objBounds.cellY, region.cellY);
			endY = Math.min(objEndY, region.cellY + effH);
		}
		if (startY >= endY && startX < endX) {
			if (region.cellY < objBounds.cellY) {
				startY = objBounds.cellY;
				endY = Math.min(objEndY, startY + effH);
			} else if (region.cellY >= objEndY) {
				endY = objEndY;
				startY = Math.max(objBounds.cellY, endY - effH);
			}
		}

		return { startX, endX, startY, endY };
	}

	private spansFullHeight(
		removal: { startY: number; endY: number },
		objBounds: CellRectangle
	): boolean {
		const objEndY = objBounds.cellY + objBounds.height;
		return removal.startY === objBounds.cellY && removal.endY === objEndY;
	}

	private spansFullWidth(
		removal: { startX: number; endX: number },
		objBounds: CellRectangle
	): boolean {
		const objEndX = objBounds.cellX + objBounds.width;
		return removal.startX === objBounds.cellX && removal.endX === objEndX;
	}

	private buildColumnRect(grid: string[][], objBounds: CellRectangle, x0: number, x1: number) {
		const rows = grid.length;
		if (x0 === -1 || x1 === -1) return null;
		let y0 = -1,
			y1 = -1;
		for (let y = 0; y < rows; y++) {
			let hasInk = false;
			for (let x = x0; x <= x1; x++) {
				if (grid[y][x] && grid[y][x] !== ' ') {
					hasInk = true;
					break;
				}
			}
			if (hasInk) {
				y0 = y0 === -1 ? y : y0;
				y1 = y;
			}
		}
		if (y0 === -1 || y1 === -1) return null;
		const lines: string[] = [];
		for (let y = y0; y <= y1; y++) {
			let line = '';
			for (let x = x0; x <= x1; x++) line += grid[y][x] ?? ' ';
			lines.push(line);
		}
		return {
			cellX: objBounds.cellX + x0,
			cellY: objBounds.cellY + y0,
			width: x1 - x0 + 1,
			height: y1 - y0 + 1,
			text: lines.join('\n')
		};
	}

	private buildRowRect(grid: string[][], objBounds: CellRectangle, y0: number, y1: number) {
		const cols = grid[0]?.length ?? 0;
		if (y0 === -1 || y1 === -1) return null;
		let x0 = -1,
			x1 = -1;
		for (let x = 0; x < cols; x++) {
			let hasInk = false;
			for (let y = y0; y <= y1; y++) {
				if (grid[y][x] && grid[y][x] !== ' ') {
					hasInk = true;
					break;
				}
			}
			if (hasInk) {
				x0 = x0 === -1 ? x : x0;
				x1 = x;
			}
		}
		if (x0 === -1 || x1 === -1) return null;
		const lines: string[] = [];
		for (let y = y0; y <= y1; y++) {
			let line = '';
			for (let x = x0; x <= x1; x++) line += grid[y][x] ?? ' ';
			lines.push(line);
		}
		return {
			cellX: objBounds.cellX + x0,
			cellY: objBounds.cellY + y0,
			width: x1 - x0 + 1,
			height: y1 - y0 + 1,
			text: lines.join('\n')
		};
	}

	private extractSubtractedText(
		startX: number,
		startY: number,
		grid: string[][],
		objBounds: CellRectangle,
		endX: number,
		endY: number
	): string {
		let subtractedText = '';
		for (let y = startY; y < endY; y++) {
			let line = '';
			for (let x = startX; x < endX; x++) {
				const localX = x - objBounds.cellX;
				const localY = y - objBounds.cellY;
				if (grid[localY] && grid[localY][localX] && grid[localY][localX] !== ' ') {
					line += grid[localY][localX];
				} else {
					line += ' ';
				}
			}
			subtractedText += line + (y < endY - 1 ? '\n' : '');
		}
		return subtractedText;
	}

	private calculateSubtraction(objects: ISmartObject[]) {
		const textObjects = objects.filter(
			(obj): obj is TextSelectionObject => obj.type === 'text-selection'
		);
		const smartObjects = objects.filter(
			(obj): obj is ISmartObject => obj.type !== 'text-selection'
		);

		const subtractedTextObjects: Array<SubtractedTextContent> = [];
		const modifiedTextObjects: Array<ModifiedTextObject> = [];
		const addedTextObjects: Array<{
			text: string;
			cellX: number;
			cellY: number;
			width: number;
			height: number;
		}> = [];
		const subtractedSmartObjects: Array<ISmartObject> = smartObjects;

		for (const obj of textObjects) {
			const objBounds = this.getObjectBounds(obj);
			const grid = this.makeGridFromText(obj.selectedText);
			const removal = this.computeRemovalWindow(objBounds, this.region);

			const subtractedText = this.extractSubtractedText(
				removal.startX,
				removal.startY,
				grid,
				objBounds,
				removal.endX,
				removal.endY
			);

			if (subtractedText.trim()) {
				subtractedTextObjects.push({
					objectId: obj.id,
					text: subtractedText,
					cellX: removal.startX,
					cellY: removal.startY,
					width: removal.endX - removal.startX,
					height: removal.endY - removal.startY
				});
			}

			for (let y = removal.startY; y < removal.endY; y++) {
				for (let x = removal.startX; x < removal.endX; x++) {
					const localX = x - objBounds.cellX;
					const localY = y - objBounds.cellY;
					if (grid[localY] && grid[localY][localX]) {
						grid[localY][localX] = ' ';
					}
				}
			}

			const concatenated = grid.map((row: string[]) => row.join('')).join('\n');
			const fallbackArea = findRectangleAreaInString(concatenated);

			const before = {
				text: obj.selectedText,
				cellX: objBounds.cellX,
				cellY: objBounds.cellY,
				width: objBounds.width,
				height: objBounds.height
			};

			const removalIsFullHeight = this.spansFullHeight(
				{ startY: removal.startY, endY: removal.endY },
				objBounds
			);
			const removalIsFullWidth = this.spansFullWidth(
				{ startX: removal.startX, endX: removal.endX },
				objBounds
			);

			if (removalIsFullHeight) {
				const rows = grid.length;
				const cols = rows > 0 ? grid[0].length : 0;
				const isEmptyCol = (x: number) => {
					for (let y = 0; y < rows; y++) if (grid[y][x] && grid[y][x] !== ' ') return false;
					return true;
				};

				let lx0 = -1,
					lx1 = -1,
					rx0 = -1,
					rx1 = -1;
				for (let x = 0; x < Math.max(0, removal.startX - objBounds.cellX); x++)
					if (!isEmptyCol(x)) {
						lx0 = lx0 === -1 ? x : lx0;
						lx1 = x;
					}
				for (let x = Math.max(0, removal.endX - objBounds.cellX); x < cols; x++)
					if (!isEmptyCol(x)) {
						rx0 = rx0 === -1 ? x : rx0;
						rx1 = x;
					}

				const leftRect = this.buildColumnRect(grid, objBounds, lx0, lx1);
				const rightRect = this.buildColumnRect(grid, objBounds, rx0, rx1);

				if (leftRect && rightRect) {
					modifiedTextObjects.push({ objectId: obj.id, before, after: null });
					addedTextObjects.push(leftRect, rightRect);
					continue;
				}
				const keep = leftRect ?? rightRect;
				if (keep) {
					modifiedTextObjects.push({ objectId: obj.id, before, after: keep });
					continue;
				}
				modifiedTextObjects.push({ objectId: obj.id, before, after: null });
				continue;
			}

			if (removalIsFullWidth) {
				const rows = grid.length;
				const cols = rows > 0 ? grid[0].length : 0;
				const isEmptyRow = (y: number) => {
					for (let x = 0; x < cols; x++) if (grid[y][x] && grid[y][x] !== ' ') return false;
					return true;
				};

				let ty0 = -1,
					ty1 = -1,
					by0 = -1,
					by1 = -1;
				for (let y = 0; y < Math.max(0, removal.startY - objBounds.cellY); y++)
					if (!isEmptyRow(y)) {
						ty0 = ty0 === -1 ? y : ty0;
						ty1 = y;
					}
				for (let y = Math.max(0, removal.endY - objBounds.cellY); y < rows; y++)
					if (!isEmptyRow(y)) {
						by0 = by0 === -1 ? y : by0;
						by1 = y;
					}

				const topRect = this.buildRowRect(grid, objBounds, ty0, ty1);
				const bottomRect = this.buildRowRect(grid, objBounds, by0, by1);

				if (topRect && bottomRect) {
					modifiedTextObjects.push({ objectId: obj.id, before, after: null });
					addedTextObjects.push(topRect, bottomRect);
					continue;
				}
				const keep = topRect ?? bottomRect;
				if (keep) {
					modifiedTextObjects.push({ objectId: obj.id, before, after: keep });
					continue;
				}
				modifiedTextObjects.push({ objectId: obj.id, before, after: null });
				continue;
			}

			let after: ModifiedTextObject['after'] = null;
			if (fallbackArea) {
				const cropped = cropContent(concatenated, fallbackArea);
				after = {
					text: cropped,
					cellX: objBounds.cellX + fallbackArea.start[0],
					cellY: objBounds.cellY + fallbackArea.start[1],
					width: fallbackArea.end[0] - fallbackArea.start[0] + 1,
					height: fallbackArea.end[1] - fallbackArea.start[1] + 1
				};
			}
			modifiedTextObjects.push({ objectId: obj.id, before, after });
		}

		return { subtractedTextObjects, modifiedTextObjects, subtractedSmartObjects, addedTextObjects };
	}
}
