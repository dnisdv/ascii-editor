import { EventEmitter } from '@editor/event-emitter';
import type {
	ITileMap,
	ITile,
	ILayer,
	ILayerModel,
	ITileModel,
	LayerEventMap,
	RegionOptions,
	DeepPartial
} from '@editor/types';
import type { BaseBusLayers } from '@editor/bus-layers';

export type LayerConfig = {
	visible: boolean;
	locked: boolean;
};

export const defaultLayerConfig = {
	visible: true,
	locked: false
};

export interface LayerOptions {
	id: string;
	name: string;
	index: number;
	opts: Partial<LayerConfig>;
	tileMap: ITileMap;
	layersBus: BaseBusLayers;
}

export class Layer extends EventEmitter<LayerEventMap> implements ILayer {
	id: string;
	name: string;
	index: number;
	opts: LayerConfig;
	tileMap: ITileMap;
	bus: BaseBusLayers;

	constructor({ id, name, opts, index, tileMap, layersBus }: LayerOptions) {
		super();
		this.id = id;
		this.name = name;

		// TODO: implement deep merge
		this.opts = { ...defaultLayerConfig, ...opts };
		this.tileMap = tileMap;
		this.index = index;
		this.bus = layersBus;
	}

	public getOpts(): LayerConfig {
		return this.opts;
	}

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

	public clear(): void {
		this.tileMap.clear();
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

	public setChar(x: number, y: number, char: string): ITileModel | null {
		const tileSize = this.tileMap.tileSize;
		const tileX = Math.floor(x / tileSize);
		const tileY = Math.floor(y / tileSize);

		if (!char.trim()) {
			const existingTile = this.tileMap.getTile(tileX, tileY);
			return this._updateTileChar(existingTile, x, y, ' ');
		}

		const tile = this.tileMap.getTile(tileX, tileY) || this.tileMap.addTile(tileX, tileY);
		return this._updateTileChar(tile, x, y, char);
	}

	public setCharToTile(
		localX: number,
		localY: number,
		char: string,
		tileCoords: { x: number; y: number }
	): void {
		const tile = this.tileMap.getTile(tileCoords.x, tileCoords.y);
		if (!char.trim() && !tile) return;

		const actualTile = tile || this.tileMap.addTile(tileCoords.x, tileCoords.y);
		this._updateTileCharLocal(actualTile, localX, localY, char);
	}

	public setRegionToTile(
		startX: number,
		startY: number,
		inputString: string,
		tileCoords: { x: number; y: number },
		options?: RegionOptions
	): void {
		const tile =
			this.tileMap.getTile(tileCoords.x, tileCoords.y) ||
			this.tileMap.addTile(tileCoords.x, tileCoords.y);

		const lines = inputString.split('\n');
		tile.setRegion(startX, startY, lines, options);

		if (tile.isEmpty()) {
			this.emit('tile::change::before');
			this.tileMap.removeTile(tile.x, tile.y);
			this.emit('tile_deleted', { x: tile.x, y: tile.y, layerId: this.id });
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	public setToRegion(
		startX: number,
		startY: number,
		inputString: string,
		options: RegionOptions = {}
	): void {
		if (!inputString) return;
		const lines = inputString.split('\n');
		if (!lines.length) return;

		const tileSize = this.tileMap.tileSize;
		const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
		const height = lines.length;

		const minTileX = Math.floor(startX / tileSize);
		const minTileY = Math.floor(startY / tileSize);
		const maxTileX = Math.floor((startX + width - 1) / tileSize);
		const maxTileY = Math.floor((startY + height - 1) / tileSize);

		for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
			for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
				this._batchWriteToTile(tileX, tileY, startX, startY, lines, options);
			}
		}
	}

	public fillRegionToTile(
		startX: number,
		startY: number,
		width: number,
		height: number,
		char: string,
		tileCoords: { x: number; y: number }
	): void {
		const tile =
			this.tileMap.getTile(tileCoords.x, tileCoords.y) ||
			this.tileMap.addTile(tileCoords.x, tileCoords.y);

		tile.fillRegion(startX, startY, width, height, char);

		if (tile.isEmpty()) {
			this.emit('tile::change::before');
			this.tileMap.removeTile(tile.x, tile.y);
			this.emit('tile_deleted', { x: tile.x, y: tile.y, layerId: this.id });
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}

	public readRegion(startX: number, startY: number, width: number, height: number): string {
		const lines: string[] = [];
		for (let y = 0; y < height; y++) {
			let line = '';
			const currentY = startY + y;
			for (let x = 0; x < width; x++) {
				line += this.getChar(startX + x, currentY);
			}
			lines.push(line);
		}
		return lines.join('\n');
	}

	public clearRegion(startX: number, startY: number, width: number, height: number): void {
		const lines: string[] = [];
		for (let h = 0; h < height; h++) {
			lines.push(' '.repeat(width));
		}
		const fillString = lines.join('\n');
		this.setToRegion(startX, startY, fillString, { skipSpaces: false });
	}

	public updateIndex(newIndex: number): void {
		this.index = newIndex;
	}

	public fillRegion(
		startX: number,
		startY: number,
		width: number,
		height: number,
		char: string
	): void {
		const line = char.repeat(width);
		const lines = Array.from({ length: height }, () => line);
		this.setToRegion(startX, startY, lines.join('\n'));
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

		this.emit('tile::change::before');
		tile.setChar(localX, localY, char);

		const model: ITileModel = { x: tile.x, y: tile.y, data: tile.data };

		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this.emit('tile_deleted', { x: tile.x, y: tile.y, layerId: this.id });
			return model;
		} else {
			this.emit('tile::change::after', { ...model, layerId: this.id });
			return model;
		}
	}

	private _updateTileCharLocal(tile: ITile, localX: number, localY: number, char: string): void {
		tile.setChar(localX, localY, char.trim() || ' ');
		if (tile.isEmpty()) {
			this.tileMap.removeTile(tile.x, tile.y);
			this.emit('tile_deleted', { x: tile.x, y: tile.y, layerId: this.id });
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

	private _emitTileChange(x: number, y: number, data: string): ITileModel {
		const model: ITileModel = { x, y, data };
		this.emit('tile::change::after', { ...model, layerId: this.id });
		return model;
	}

	public update(updates: DeepPartial<ILayerModel>): { before: ILayerModel; after: ILayerModel } {
		const beforeState: ILayerModel = {
			id: this.id,
			name: this.name,
			index: this.index,
			opts: { ...this.opts }
		};

		if (updates.name !== undefined) {
			this.name = updates.name;
		}
		if (updates.index !== undefined) {
			this.index = updates.index;
		}
		if (updates.opts) {
			this.opts = { ...defaultLayerConfig, ...this.opts, ...updates.opts };
		}

		const afterState: ILayerModel = {
			id: this.id,
			name: this.name,
			index: this.index,
			opts: { ...this.opts }
		};

		return { before: beforeState, after: afterState };
	}

	private _batchWriteToTile(
		tileX: number,
		tileY: number,
		startX: number,
		startY: number,
		lines: string[],
		options: RegionOptions
	): void {
		const tileSize = this.tileMap.tileSize;

		const tileLeft = tileX * tileSize;
		const tileTop = tileY * tileSize;
		const tileRight = tileLeft + tileSize;
		const tileBottom = tileTop + tileSize;

		const textLeft = startX;
		const textTop = startY;
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
			this.emit('tile_deleted', { x: tile.x, y: tile.y, layerId: this.id });
		} else {
			this._emitTileChange(tile.x, tile.y, tile.data);
		}
	}
}
