import {
	SingleSelectSession,
	type Rectangle,
	type SelectedContentEntity
} from '../selection-session';
import type { ISessionCommand } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import type { ILayer } from '@editor/types';
import type { CoreApi } from '@editor/core';

export class PopulateRegionCommand implements ISessionCommand {
	constructor(
		private coreApi: CoreApi,
		private region: { x: number; y: number; width: number; height: number },
		private sourceLayerId: string
	) {}

	public execute(session: SingleSelectSession, _: CoreApi, manager: SelectionSessionManager): void {
		this.selectRegion(session, this.region);
		session.setSourceLayerId(this.sourceLayerId);
		this.populateSelectedRegion(session);

		const newWorldBoundingBox = this._calculateWorldBoundingBoxFromContent(
			session.getSelectedContent()
		);
		session.updateSelectedRegion(newWorldBoundingBox);

		this.clearContentFromLayer(session.getSelectedContent(), session.getSourceLayer());
		this.drawContentOnLayer(session.getSelectedContent(), session.getTargetLayer());

		this.addHistoryRecord(session, manager);
	}

	private addHistoryRecord(session: SingleSelectSession, manager: SelectionSessionManager) {
		if (!session.isEmpty()) {
			this.coreApi.getHistoryManager().applyAction(
				{
					type: 'select::session_select',
					targetId: 'select::session',
					before: { session: null },
					after: { session: manager.serializeSession(session) }
				},
				{ applyAction: false }
			);
		}
	}

	private clearContentFromLayer(tile: SelectedContentEntity | null, layer: ILayer | null): void {
		if (!tile || !tile.region || !layer) return;
		const { region } = tile;
		layer.clearRegion(region.startX, region.startY, region.width, region.height);
	}

	private drawContentOnLayer(tile: SelectedContentEntity | null, layer: ILayer | null): void {
		if (!tile || !layer) return;
		const { region, data } = tile;
		layer.setToRegion(region.startX, region.startY, data);
	}

	public selectRegion(
		session: SingleSelectSession,
		worldRegion: { x: number; y: number; width: number; height: number }
	): void {
		session.updateSelectedRegion({
			startX: worldRegion.x,
			startY: worldRegion.y,
			width: worldRegion.width,
			height: worldRegion.height
		});
	}

	private _calculateWorldBoundingBoxFromContent(
		content: SelectedContentEntity | null
	): Rectangle | null {
		if (!content || !content.region) return null;

		const {
			region: { startX: cellX, startY: cellY, width: cellW, height: cellH }
		} = content;
		const worldStart = this._cellToWorld(cellX, cellY);
		const worldEnd = this._cellToWorld(cellX + cellW, cellY + cellH);

		return {
			startX: worldStart.x,
			startY: worldStart.y,
			width: worldEnd.x - worldStart.x,
			height: worldEnd.y - worldStart.y
		};
	}

	private _cellToWorld(cellX: number, cellY: number): { x: number; y: number } {
		const fontMetrics = this.coreApi.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width;
		const charHeight = fontMetrics?.dimensions?.height;
		return { x: cellX * charWidth, y: cellY * charHeight };
	}

	populateSelectedRegion(session: SingleSelectSession): void {
		const sourceLayer = session.getSourceLayer();
		if (!sourceLayer) return;

		const { startX, startY, width, height } = session.getSelectedRegion()!;

		const startCellPos = this.worldToCellPos(startX, startY);
		const endCellPos = this.worldToCellPos(startX + width, startY + height);

		const tilesFound = this.worldPositionToTileMap(
			startCellPos.x,
			startCellPos.y,
			endCellPos.x - startCellPos.x,
			endCellPos.y - startCellPos.y
		);

		const tileContent = sourceLayer.tileMap.query(
			tilesFound.startTileX,
			tilesFound.startTileY,
			tilesFound.endTileX - tilesFound.startTileX,
			tilesFound.endTileY - tilesFound.startTileY
		);

		const collected: SelectedContentEntity[] = [];

		for (const tile of tileContent) {
			const from = this.cellPositionInsideTile(startCellPos.x, startCellPos.y, tile.x, tile.y);
			const to = this.cellPositionInsideTile(endCellPos.x, endCellPos.y, tile.x, tile.y);

			const slice = tile.query(from.x, from.y, to.x - from.x + 1, to.y - from.y + 1);

			const boundary = findRectangleAreaInString(slice);
			if (!boundary) continue;

			const cropped = this.cropTileContent(slice, boundary);

			const { start, end } = boundary;

			const boundaryStartX = from.x + start[0];
			const boundaryStartY = from.y + start[1];

			const w = end[0] - start[0] + 1;
			const h = end[1] - start[1] + 1;

			const { x, y } = this.tileCellPosToWorldCell(boundaryStartX, boundaryStartY, tile.x, tile.y);
			collected.push({ region: { startX: x, startY: y, width: w, height: h }, data: cropped });
		}
		if (!collected.length) return;

		const tile = combineTiles(collected);
		session.updateSelectedContent(tile);
	}

	private worldToCellPos(x: number, y: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		return { x: Math.floor(x / charWidth), y: Math.floor(y / charHeight) };
	}

	private worldPositionToTileMap(x: number, y: number, w: number, h: number) {
		const size = this.coreApi.getConfig().tileSize;
		return {
			startTileX: Math.floor(x / size),
			startTileY: Math.floor(y / size),
			endTileX: Math.floor((x + w) / size),
			endTileY: Math.floor((y + h) / size)
		};
	}

	private cellPositionInsideTile(cx: number, cy: number, tx: number, ty: number) {
		const size = this.coreApi.getConfig().tileSize;
		return { x: Math.max(0, cx - tx * size), y: Math.max(0, cy - ty * size) };
	}

	private cropTileContent(
		full: string,
		boundary: { start: [number, number]; end: [number, number] }
	) {
		const rows = full.split('\n');
		const { start, end } = boundary;
		const extracted = rows
			.slice(start[1], end[1] + 1)
			.map((row) => row.slice(start[0], end[0] + 1));
		return extracted.join('\n');
	}

	private tileCellPosToWorldCell(
		cx: number,
		cy: number,
		tileX: number,
		tileY: number
	): { x: number; y: number } {
		const tileSize = this.coreApi.getConfig().tileSize;

		const globalCellX = tileX * tileSize + cx;
		const globalCellY = tileY * tileSize + cy;

		const worldX = globalCellX;
		const worldY = globalCellY;

		return { x: worldX, y: worldY };
	}
}
export function findRectangleAreaInString(
	gridString: string
): { start: [number, number]; end: [number, number] } | null {
	const lines = gridString.split('\n');
	const numRows = lines.length;
	if (numRows === 0) {
		return null;
	}

	const numCols = lines[0].length;
	if (numCols === 0 && numRows === 1 && lines[0] === '') {
		return null;
	}

	let top = -1,
		left = -1,
		bottom = -1,
		right = -1;
	let foundContent = false;

	for (let r = 0; r < numRows; r++) {
		for (let c = 0; c < numCols; c++) {
			if (lines[r] && lines[r][c] && lines[r][c] !== '.' && lines[r][c] !== ' ') {
				if (!foundContent) {
					top = r;
					left = c;
					bottom = r;
					right = c;
					foundContent = true;
				} else {
					if (r < top) top = r;
					if (c < left) left = c;
					if (r > bottom) bottom = r;
					if (c > right) right = c;
				}
			}
		}
	}

	if (!foundContent) {
		return null;
	}

	return {
		start: [left, top], // [col, row]
		end: [right, bottom] // [col, row]
	};
}

export function combineTiles(tiles: SelectedContentEntity[]): SelectedContentEntity {
	if (!tiles.length) {
		return { region: { startX: 0, startY: 0, width: 0, height: 0 }, data: '' };
	}

	const minX = Math.min(...tiles.map((t) => t.region.startX));
	const minY = Math.min(...tiles.map((t) => t.region.startY));
	const maxX = Math.max(...tiles.map((t) => t.region.startX + t.region.width));
	const maxY = Math.max(...tiles.map((t) => t.region.startY + t.region.height));

	const combinedWidth = maxX - minX;
	const combinedHeight = maxY - minY;

	if (combinedWidth <= 0 || combinedHeight <= 0) {
		return { region: { startX: minX, startY: minY, width: 0, height: 0 }, data: '' };
	}

	const canvas: string[][] = Array.from({ length: combinedHeight }, () =>
		Array(combinedWidth).fill(' ')
	);

	for (const tile of tiles) {
		const relativeStartX = tile.region.startX - minX;
		const relativeStartY = tile.region.startY - minY;
		const dataLines = tile.data.split('\n');

		dataLines.forEach((line, rowIdx) => {
			const canvasRow = relativeStartY + rowIdx;
			if (canvasRow >= 0 && canvasRow < combinedHeight) {
				for (let colIdx = 0; colIdx < line.length; colIdx++) {
					const canvasCol = relativeStartX + colIdx;
					if (canvasCol >= 0 && canvasCol < combinedWidth) {
						if (line[colIdx] !== ' ') {
							canvas[canvasRow][canvasCol] = line[colIdx];
						}
					}
				}
			}
		});
	}

	return {
		region: { startX: minX, startY: minY, width: combinedWidth, height: combinedHeight },
		data: canvas.map((r) => r.join('')).join('\n')
	};
}
