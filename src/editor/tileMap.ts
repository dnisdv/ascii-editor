import { Tile } from './tile';
import type { ITile, ITileMap, SerializedTile, SerializedTileMap } from './types';

export class TileMap implements ITileMap {
	readonly tileSize: number;
	public map: Map<string, ITile> = new Map();

	constructor({ tileSize }: { tileSize: number }) {
		this.tileSize = tileSize;
	}

	private createCellKey(x: number, y: number): string {
		return `${x},${y}`;
	}

	public isEmpty(): boolean {
		return this.map.size === 0;
	}

	public addTile(x: number, y: number): ITile {
		const key = this.createCellKey(x, y);
		if (this.map.has(key)) {
			return this.map.get(key)!;
		}

		if (this.map.size > 1000) {
			this.cleanUnusedTiles();
		}

		const tile = new Tile(this.tileSize, x, y);
		this.map.set(key, tile);
		return tile;
	}

	public cleanUnusedTiles() {
		for (const [key, tile] of this.map.entries()) {
			if (tile.isEmpty()) {
				this.map.delete(key);
			}
		}
	}

	public removeTile(x: number, y: number): void {
		const key = this.createCellKey(x, y);
		this.map.delete(key);
	}

	public queryAllKeys() {
		return Array.from(this.map.keys());
	}

	public queryAll(): Tile[] {
		return Array.from(this.map.values());
	}

	public query(x: number, y: number, width: number, height: number): ITile[] {
		const startX = Math.floor(x);
		const startY = Math.floor(y);
		const endX = Math.ceil(x + width);
		const endY = Math.ceil(y + height);

		const result: Set<ITile> = new Set();
		for (let cellX = startX; cellX <= endX; cellX++) {
			for (let cellY = startY; cellY <= endY; cellY++) {
				const key = this.createCellKey(cellX, cellY);
				const tile = this.map.get(key);
				if (tile) {
					result.add(tile);
				}
			}
		}
		return Array.from(result);
	}

	public getOrCreateTile(x: number, y: number): ITile {
		const key = this.createCellKey(x, y);
		let tile = this.map.get(key);

		if (!tile) {
			tile = new Tile(this.tileSize, x, y, ' '.repeat(this.tileSize * this.tileSize));
			this.map.set(key, tile);
		}
		return tile;
	}

	public getTile(x: number, y: number): ITile | null {
		const key = this.createCellKey(x, y);
		return this.map.get(key) || null;
	}

	public createTileBoundary(
		x: number,
		y: number
	): { x: number; y: number; width: number; height: number } {
		return {
			x: x * this.tileSize,
			y: y * this.tileSize,
			width: this.tileSize,
			height: this.tileSize
		};
	}

	public queryByData(searchString: string): Tile[] {
		return Array.from(this.map.values()).filter((tile) => tile.data.includes(searchString));
	}

	public clear() {
		this.map.clear();
	}

	public serialize(): SerializedTileMap {
		return {
			map: Array.from(this.map.entries()).reduce<Record<string, SerializedTile>>(
				(acc, [key, tile]) => {
					acc[key] = tile.serialize();
					return acc;
				},
				{} as Record<string, ITile>
			)
		};
	}

	static deserialize(data: SerializedTileMap): TileMap {
		const tileMap = new TileMap({ tileSize: 25 });
		tileMap.map = new Map(
			Object.entries(data.map).map(([key, tileData]) => [key, Tile.deserialize(tileData)])
		);
		return tileMap;
	}
}
