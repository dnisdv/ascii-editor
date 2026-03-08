import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SerializedSmartObjectData = Record<string, any>;
export type SerializedSmartObject = SerializedSmartObjectData;

export const SmartObjectSerializableSchema = z.object({
	id: z.string(),
	index: z.number().optional(),
	orderKey: z.string().optional(),
	type: z.string(),
	properties: z.any(),
	data: z.any()
});

export type SmartObjectSerializableSchemaType = z.infer<typeof SmartObjectSerializableSchema>;
