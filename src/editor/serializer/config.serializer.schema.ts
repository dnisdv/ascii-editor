import { z } from 'zod';

export type ConfigSerializableSchemaType = {
	tileSize: number;
};

export const ConfigSerializableSchema = z.object({
	tileSize: z.number()
});
