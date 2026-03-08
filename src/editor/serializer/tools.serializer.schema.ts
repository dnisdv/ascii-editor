import { z } from 'zod';

export const ToolsConfigSerializableSchema = z.object({
	activeTool: z.string().nullable(),
	data: z.record(z.string(), z.record(z.string(), z.unknown())).default({})
});

export type ToolsConfigSerializableSchemaType = z.infer<typeof ToolsConfigSerializableSchema>;
