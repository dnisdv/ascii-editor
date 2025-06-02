import { z } from 'zod';

export type SerializedTile = {
	tileSize: number;
	x: number;
	y: number;
	data: string;
};

export type TileMap = {
	[xy in string]: SerializedTile;
};

export type SerializedTileMap = {
	map: TileMap;
};

export type LayerSerializableSchemaType = {
	id: string;
	name: string;
	tileMap?: SerializedTileMap;
	index: number;
	opts: {
		visible: boolean;
		locked: boolean;
	};
};

const TileSchema = z.object({
	tileSize: z.number(),
	x: z.number(),
	y: z.number(),
	data: z.string()
});

const TileMapSchema = z.record(z.string(), TileSchema);

export const LayerSerializableSchema = z.object({
	id: z.string(),
	name: z.string(),
	tileMap: z
		.object({
			map: TileMapSchema
		})
		.optional(),
	index: z.number(),
	opts: z.object({
		visible: z.boolean(),
		locked: z.boolean()
	})
});
