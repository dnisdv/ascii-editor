import { TileMap } from '../tileMap';
import type { Config } from '@editor/config';
import {
	TileMapSerializer,
	type CellRectangle,
	type ITile,
	type ITileMap,
	type ITileModel,
	type RegionOptions
} from '@editor/types';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import { BaseSmartObject } from './smart-object.base';
import type { ISmartObject } from './smart-object.interface';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

export class TextGridObject extends BaseSmartObject {
	private tileMap: ITileMap;
	private tileMapSerializer: TileMapSerializer;

	readonly id: string = 'default-text-grid';
	readonly type: string = 'text-grid';
	bounds: CellRectangle = { cellX: -Infinity, cellY: -Infinity, width: Infinity, height: Infinity };
	rotation: number = 0;

	constructor(config: Config, tileMap?: ITileMap) {
		super(
			{ cellX: -Infinity, cellY: -Infinity, width: Infinity, height: Infinity },
			{
				capabilities: {
					canMove: false,
					canResize: false,
					canRotate: false,
					canSelect: false
				},
				properties: {}
			}
		);
		(this as { -readonly [key in 'id']: string })['id'] = 'default-text-grid';
		this.tileMap = tileMap ?? new TileMap({ tileSize: config.tileSize });

		this.setName('Text Grid');

		this.tileMapSerializer = new TileMapSerializer();
	}

	public clone(): ISmartObject {
		throw new Error('You must not clone text grid object');
	}

	hitTest(): boolean {
		return true;
	}

	regionHitTest(): boolean {
		return true;
	}

	render(deps: AsciiRenderingDeps): void {
		const camera = deps.camera;
		const fontManager = deps.fontManager;
		const config = deps.config;
		const { canvasKit, skCanvas } = deps;

		const viewport = camera.getViewport();
		const {
			dimensions: { height: charHeight, width: charWidth }
		} = fontManager.getMetrics();
		const tileSize = config.tileSize;

		const pxW = charWidth * camera.scale;
		const pxH = charHeight * camera.scale;
		const LOW_LOD_SKIP_PX = 0.5;
		if (pxW < LOW_LOD_SKIP_PX && pxH < LOW_LOD_SKIP_PX) {
			return;
		}

		const visibleTileXStart = Math.floor(viewport.left / (charWidth * tileSize));
		const visibleTileYStart = Math.floor(viewport.top / (charHeight * tileSize));
		const visibleTileXEnd = Math.ceil(viewport.right / (charWidth * tileSize));
		const visibleTileYEnd = Math.ceil(viewport.bottom / (charHeight * tileSize));

		const { foreground } = config.getTheme();
		const fontCfg = fontManager.getCurrentFont().getConfig();
		const typeface = fontManager.getFontMgr().matchFamilyStyle(fontCfg.family, {});
		const font = new canvasKit.Font(typeface, fontManager.getMetrics().size);
		const paint = new canvasKit.Paint();
		const opacity = deps.opacity ?? 1;
		paint.setColor(
			canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3] * opacity)
		);
		paint.setAntiAlias(false);

		for (let y = visibleTileYStart; y < visibleTileYEnd; y++) {
			for (let x = visibleTileXStart; x < visibleTileXEnd; x++) {
				const tile = this.tileMap.getTile(x, y);
				if (tile && !tile.isEmpty()) {
					const tileData = tile.toString();
					if (!tileData || !tileData.trim()) continue;

					if (!tileData || !tileData.trim()) continue;

					const drawX = tile.x * tileSize * charWidth;
					const drawY = tile.y * tileSize * charHeight;

					const fm = font.getMetrics?.();
					const baseline = fm && typeof fm.ascent === 'number' ? -fm.ascent : 0;

					const allGlyphs = font.getGlyphIDs(tileData) as Uint16Array;
					const maxChars = tileSize * tileSize;
					const glyphBuf = new Uint16Array(maxChars);
					const posBuf = new Float32Array(maxChars * 2);
					let count = 0;
					let row = 0;
					let col = 0;
					for (let i = 0; i < tileData.length; i++) {
						const ch = tileData[i];
						if (ch === '\n') {
							row++;
							col = 0;
							continue;
						}
						if (ch === ' ') {
							col++;
							continue;
						}
						const gid = allGlyphs[i];
						if (gid === 0) {
							col++;
							continue;
						}
						glyphBuf[count] = gid;
						const pIdx = count * 2;
						posBuf[pIdx] = drawX + col * charWidth;
						posBuf[pIdx + 1] = drawY + row * charHeight + baseline;
						count++;
						col++;
					}
					if (count > 0) {
						skCanvas.drawGlyphs(
							glyphBuf.subarray(0, count),
							posBuf.subarray(0, count * 2),
							0,
							0,
							font,
							paint
						);
					}
				}
			}
		}
	}

	public getTileMap(): ITileMap {
		return this.tileMap;
	}

	private _notifyChanged(): void {}

	public addTile(x: number, y: number): ITile {
		return this.tileMap.addTile(x, y);
	}

	public queryTiles(x: number, y: number, width: number, height: number): ITile[] {
		return this.tileMap.query(x, y, width, height);
	}

	public queryAllTilesKeys(): string[] {
		return this.tileMap.queryAll().map((tile) => `${tile.x},${tile.y}`);
	}

	public queryAllTiles(): ITile[] {
		return this.tileMap.queryAll();
	}

	public getTileAtPosition(x: number, y: number): ITile | null {
		const tileSize = this.tileMap.tileSize;
		const tileX = Math.floor(x / tileSize);
		const tileY = Math.floor(y / tileSize);

		const tile = this.tileMap.getTile(tileX, tileY);
		if (!tile) return null;

		const tileStartX = tile.x * tileSize;
		const tileStartY = tile.y * tileSize;
		const tileEndX = tileStartX + tileSize;
		const tileEndY = tileStartY + tileSize;

		if (x >= tileStartX && x < tileEndX && y >= tileStartY && y < tileEndY) {
			return tile;
		}
		return null;
	}

	public getChar(x: number, y: number): string {
		const tileSize = this.tileMap.tileSize;
		const tile = this.getTileAtPosition(x, y);
		if (!tile) {
			return ' ';
		}

		const localX = x % tileSize;
		const localY = y % tileSize;
		return tile.getChar(localX, localY) || ' ';
	}

	public setChar(cellX: number, cellY: number, char: string): ITileModel | null {
		const tileSize = this.tileMap.tileSize;
		const tileX = Math.floor(cellX / tileSize);
		const tileY = Math.floor(cellY / tileSize);

		if (!char.trim()) {
			const existingTile = this.tileMap.getTile(tileX, tileY);
			return this._updateTileChar(existingTile, cellX, cellY, ' ');
		}

		const tile = this.tileMap.getTile(tileX, tileY) || this.tileMap.addTile(tileX, tileY);
		return this._updateTileChar(tile, cellX, cellY, char);
	}

	private _updateTileChar(
		tile: ITile | null,
		x: number,
		y: number,
		char: string
	): ITileModel | null {
		if (!tile) return null;
		const tileSize = tile.tileSize;
		const localX = x % tileSize;
		const localY = y % tileSize;

		tile.setChar(localX, localY, char);

		const model: ITileModel = { x: tile.x, y: tile.y, data: tile.data };

		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this._emitTileDelete(tile.x, tile.y);
			return model;
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
			return model;
		}
	}

	public setCharToTile(
		cellX: number,
		cellY: number,
		char: string,
		tileCoords: { x: number; y: number }
	): void {
		const tile = this.tileMap.getTile(tileCoords.x, tileCoords.y);
		if (!char.trim() && !tile) return;

		const actualTile = tile || this.tileMap.addTile(tileCoords.x, tileCoords.y);
		this._updateTileCharLocal(actualTile, cellX, cellY, char);
	}

	private _updateTileCharLocal(tile: ITile, localX: number, localY: number, char: string): void {
		tile.setChar(localX, localY, char.trim() || ' ');
		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this._emitTileDelete(tile.x, tile.y);
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	private _emitTileChange(x: number, y: number, data: string): ITileModel {
		const tile = this.tileMap.getTile(x, y)!;
		this.emit('op', {
			op: 'replace',
			path: `data.${tile.x},${tile.y}`,
			value: this.tileMapSerializer.serializeTile(tile)
		});
		const model: ITileModel = { x, y, data };
		return model;
	}

	private _emitTileDelete(x: number, y: number): void {
		this.emit('op', { op: 'remove', path: `data.${x},${y}` });
	}

	public setToRegion(
		cellX: number,
		cellY: number,
		inputString: string,
		options: RegionOptions = {}
	): void {
		if (!inputString) return;
		const lines = inputString.split('\n');
		if (!lines.length) return;

		const tileSize = this.tileMap.tileSize;
		const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
		const height = lines.length;

		const minTileX = Math.floor(cellX / tileSize);
		const minTileY = Math.floor(cellY / tileSize);
		const maxTileX = Math.floor((cellX + width - 1) / tileSize);
		const maxTileY = Math.floor((cellY + height - 1) / tileSize);

		for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
			for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
				this._batchWriteToTile(tileX, tileY, cellX, cellY, lines, options);
			}
		}
	}

	private _batchWriteToTile(
		tileX: number,
		tileY: number,
		startCellX: number,
		startCellY: number,
		lines: string[],
		options: RegionOptions
	): void {
		const tileSize = this.tileMap.tileSize;

		const tileLeft = tileX * tileSize;
		const tileTop = tileY * tileSize;
		const tileRight = tileLeft + tileSize;
		const tileBottom = tileTop + tileSize;

		const textLeft = startCellX;
		const textTop = startCellY;
		const textWidth = lines.reduce((max, line) => Math.max(max, line.length), 0);
		const textHeight = lines.length;
		const textRight = textLeft + textWidth;
		const textBottom = textTop + textHeight;

		const overlapLeft = Math.max(tileLeft, textLeft);
		const overlapTop = Math.max(tileTop, textTop);
		const overlapRight = Math.min(tileRight, textRight);
		const overlapBottom = Math.min(tileBottom, textBottom);

		if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
			return;
		}

		const subText = this._extractSubText(
			lines,
			overlapLeft - textLeft,
			overlapTop - textTop,
			overlapRight - textLeft,
			overlapBottom - textTop
		);

		const existingTile = this.tileMap.getTile(tileX, tileY);

		if (!existingTile && options.skipSpaces !== false && !subText.trim()) {
			return;
		}

		const tile = existingTile || this.tileMap.addTile(tileX, tileY);
		const subLines = subText.split('\n');
		const localOffsetX = overlapLeft - tileLeft;
		const localOffsetY = overlapTop - tileTop;

		tile.setRegion(localOffsetX, localOffsetY, subLines, options);

		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this._emitTileDelete(tile.x, tile.y);
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	private _extractSubText(
		lines: string[],
		left: number,
		top: number,
		right: number,
		bottom: number
	): string {
		let result = '';
		for (let row = top; row < bottom; row++) {
			const line = lines[row] || '';
			result += line.substring(left, right) + '\n';
		}
		return result;
	}

	public setRegionToTile(
		cellX: number,
		cellY: number,
		inputString: string,
		tileCoords: { x: number; y: number },
		options?: RegionOptions
	): void {
		const tile =
			this.tileMap.getTile(tileCoords.x, tileCoords.y) ||
			this.tileMap.addTile(tileCoords.x, tileCoords.y);

		const lines = inputString.split('\n');
		tile.setRegion(cellX, cellY, lines, options);

		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this._emitTileDelete(tile.x, tile.y);
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	public readRegion(cellX: number, cellY: number, width: number, height: number): string {
		if (width <= 0 || height <= 0) return '';

		const tileSize = this.tileMap.tileSize;
		const minTileX = Math.floor(cellX / tileSize);
		const minTileY = Math.floor(cellY / tileSize);
		const maxTileX = Math.floor((cellX + width - 1) / tileSize);
		const maxTileY = Math.floor((cellY + height - 1) / tileSize);

		const rows: string[][] = Array.from({ length: height }, () => Array<string>(width).fill(' '));

		for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
			for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
				const tile = this.tileMap.getTile(tileX, tileY);
				if (!tile) continue;

				const tileLeft = tileX * tileSize;
				const tileTop = tileY * tileSize;
				const tileRight = tileLeft + tileSize;
				const tileBottom = tileTop + tileSize;

				const regionLeft = cellX;
				const regionTop = cellY;
				const regionRight = cellX + width;
				const regionBottom = cellY + height;

				const overlapLeft = Math.max(tileLeft, regionLeft);
				const overlapTop = Math.max(tileTop, regionTop);
				const overlapRight = Math.min(tileRight, regionRight);
				const overlapBottom = Math.min(tileBottom, regionBottom);

				if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;

				const localX = overlapLeft - tileLeft;
				const localY = overlapTop - tileTop;
				const sliceWidth = overlapRight - overlapLeft;
				const sliceHeight = overlapBottom - overlapTop;

				const slice = tile.query(localX, localY, sliceWidth, sliceHeight);
				const sliceLines = slice ? slice.split('\n') : [];
				const outColStart = overlapLeft - regionLeft;
				const outRowStart = overlapTop - regionTop;
				for (let r = 0; r < sliceHeight; r++) {
					const frag = sliceLines[r] || '';
					const outRow = rows[outRowStart + r];
					for (let c = 0; c < frag.length; c++) {
						outRow[outColStart + c] = frag[c] || ' ';
					}
				}
			}
		}

		return rows.map((arr) => arr.join('')).join('\n');
	}

	public clear(): void {
		this.tileMap.clear();
		this._notifyChanged();
	}

	public clearRegion(cellX: number, cellY: number, width: number, height: number): void {
		const tileSize = this.tileMap.tileSize;
		const minTileX = Math.floor(cellX / tileSize);
		const minTileY = Math.floor(cellY / tileSize);
		const maxTileX = Math.floor((cellX + width - 1) / tileSize);
		const maxTileY = Math.floor((cellY + height - 1) / tileSize);

		for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
			for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
				const tileLeft = tileX * tileSize;
				const tileTop = tileY * tileSize;
				const tileRight = tileLeft + tileSize;
				const tileBottom = tileTop + tileSize;

				const overlapLeft = Math.max(tileLeft, cellX);
				const overlapTop = Math.max(tileTop, cellY);
				const overlapRight = Math.min(tileRight, cellX + width);
				const overlapBottom = Math.min(tileBottom, cellY + height);
				if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) continue;

				const localX = overlapLeft - tileLeft;
				const localY = overlapTop - tileTop;
				const sliceWidth = overlapRight - overlapLeft;
				const sliceHeight = overlapBottom - overlapTop;

				const tile = this.tileMap.getTile(tileX, tileY) || this.tileMap.addTile(tileX, tileY);
				tile.fillRegion(localX, localY, sliceWidth, sliceHeight, ' ');

				if (tile.isEmpty()) {
					this.tileMap.removeTile(tile.x, tile.y);
					this._emitTileDelete(tile.x, tile.y);
				} else {
					this._emitTileChange(tile.x, tile.y, tile.data);
				}
			}
		}
	}

	public fillRegion(
		cellX: number,
		cellY: number,
		width: number,
		height: number,
		char: string
	): void {
		const line = char.repeat(width);
		const lines = Array.from({ length: height }, () => line);
		this.setToRegion(cellX, cellY, lines.join('\n'));
	}

	public fillRegionToTile(
		cellX: number,
		cellY: number,
		width: number,
		height: number,
		char: string,
		tileCoords: { x: number; y: number }
	): void {
		const tile =
			this.tileMap.getTile(tileCoords.x, tileCoords.y) ||
			this.tileMap.addTile(tileCoords.x, tileCoords.y);

		tile.fillRegion(cellX, cellY, width, height, char);

		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this._emitTileDelete(tile.x, tile.y);
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	move(): void {}

	getPropertiesSchema(): Map<string, unknown> {
		return new Map();
	}

	toJson(): SmartObjectSerializableSchemaType['data'] {
		return this.tileMapSerializer.serialize(this.tileMap);
	}

	public toString(): string {
		return '';
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static deserialize(config: Config, data: any): TextGridObject {
		const tileMapSerializer = new TileMapSerializer();
		const tileMap = tileMapSerializer.deserialize(data, 25);
		return new TextGridObject(config, tileMap);
	}
}
