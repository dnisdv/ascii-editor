import { z } from 'zod';

export const LayerGroupSerializableSchema = z.object({
	id: z.string(),
	name: z.string(),
	collapsed: z.boolean(),
	parentId: z.string().nullable(),
	index: z.number(),
	opts: z.object({
		visible: z.boolean(),
		locked: z.boolean()
	})
});

export type LayerGroupSerializableSchemaType = z.infer<typeof LayerGroupSerializableSchema>;
