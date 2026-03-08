import { Tile } from '@editor/tile';
import type { ITile } from '@editor/types';
import type { TileSchemaType } from './tile.serializer.schema';

export class TileSerializer {
	public serialize(tile: ITile): TileSchemaType {
		return {
			tileSize: tile.tileSize,
			x: tile.x,
			y: tile.y,
			data: tile.data
		};
	}

	public deserialize(data: TileSchemaType): ITile {
		return new Tile(data.tileSize, data.x, data.y, data.data);
	}
}
