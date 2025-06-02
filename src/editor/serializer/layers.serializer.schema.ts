import { z } from 'zod';
import {
	LayerSerializableSchema,
	type LayerSerializableSchemaType
} from './layer.serializer.schema';

export type LayersSerializableSchemaType = {
	activeLayerKey: string | null;
	data: {
		[x in string]: LayerSerializableSchemaType;
	};
};

export const LayersSerializableSchema = z.object({
	activeLayerKey: z.string().nullable(),
	data: z.record(z.string(), LayerSerializableSchema)
});
