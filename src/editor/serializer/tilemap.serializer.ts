import type { ITile, ITileMap } from '@editor/types';
import { TileSerializer } from './tile.serialzer';
import type { TileMapSchemaType } from './tilemap.serializer.schema';
import { TileMap } from '@editor/tileMap';

export class TileMapSerializer {
	private tileSerializer: TileSerializer;

	constructor() {
		this.tileSerializer = new TileSerializer();
	}

	public serialize(tileMap: ITileMap): TileMapSchemaType {
		const data: TileMapSchemaType = {};
		for (const tile of tileMap.queryAll()) {
			const key = `${tile.x},${tile.y}`;
			data[key] = this.tileSerializer.serialize(tile);
		}
		return data;
	}

	public serializeTile(tile: ITile): TileMapSchemaType[string] {
		return this.tileSerializer.serialize(tile);
	}

	public deserialize(data: TileMapSchemaType, tileSize: number): ITileMap {
		const tileMap = new TileMap({ tileSize });
		tileMap.map = new Map(
			Object.entries(data).map(([key, tileData]) => [
				key,
				this.tileSerializer.deserialize(tileData)
			])
		);
		return tileMap;
	}
}
