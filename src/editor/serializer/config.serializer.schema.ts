import { z } from 'zod';

export const ConfigSerializableSchema = z.object({
	tileSize: z.number()
});

export type ConfigSerializableSchemaType = z.infer<typeof ConfigSerializableSchema>;
