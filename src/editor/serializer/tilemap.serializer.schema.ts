import { z } from 'zod';
import { TileSchema } from './tile.serializer.schema';

export const TileMapSchema = z.record(z.string(), TileSchema);
export type TileMapSchemaType = z.infer<typeof TileMapSchema>;
