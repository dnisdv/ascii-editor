import { z } from 'zod';
import { LayerSerializableSchema } from './layer.serializer.schema';

export const LayersSerializableSchema = z.object({
	activeLayerKey: z.string().nullable(),
	data: z.record(z.string(), LayerSerializableSchema)
});

export type LayersSerializableSchemaType = z.infer<typeof LayersSerializableSchema>;
