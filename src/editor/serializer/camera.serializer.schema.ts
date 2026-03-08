import { z } from 'zod';

export const CameraSerializableSchema = z.object({
	offsetX: z.number(),
	offsetY: z.number(),
	scale: z.number()
});

export type CameraSerializableSchemaType = z.infer<typeof CameraSerializableSchema>;
