import { z } from 'zod';

export type CameraSerializableSchemaType = {
	offsetX: number;
	offsetY: number;
	scale: number;
};

export const CameraSerializableSchema = z.object({
	offsetX: z.number(),
	offsetY: z.number(),
	scale: z.number()
});
