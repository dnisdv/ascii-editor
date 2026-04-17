import { z } from 'zod';
import { SmartObjectSerializableSchema } from './smart-object.schema';

export const LayerSerializableSchema = z.object({
	id: z.string(),
	name: z.string(),
	index: z.number(),
	objects: z.record(z.string(), SmartObjectSerializableSchema),
	objectOrder: z.array(z.string()),
	orderKeys: z.record(z.string(), z.string()).optional(),
	opts: z.object({
		visible: z.boolean(),
		locked: z.boolean()
	}),
	groupId: z.string().nullable().optional()
});

export type LayerSerializableSchemaType = z.infer<typeof LayerSerializableSchema>;
