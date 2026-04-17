import { z } from 'zod';
import { LayerSerializableSchema } from './layer.serializer.schema';
import { LayerGroupSerializableSchema } from './group.serializer.schema';

export const LayersSerializableSchema = z.object({
	activeLayerKey: z.string().nullable(),
	data: z.record(z.string(), LayerSerializableSchema),
	groups: z.record(z.string(), LayerGroupSerializableSchema).optional()
});

export type LayersSerializableSchemaType = z.infer<typeof LayersSerializableSchema>;
