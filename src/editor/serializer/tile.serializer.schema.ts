import { z } from 'zod';

export const TileSchema = z.object({
	tileSize: z.number(),
	x: z.number(),
	y: z.number(),
	data: z.string()
});

export type TileSchemaType = z.infer<typeof TileSchema>;
