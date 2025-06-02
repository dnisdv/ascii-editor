import { z } from 'zod';

export type ToolsConfigSerializableSchemaType = {
	activeTool: string | null;
	data:
		| {
				[toolName in string]: Record<string, unknown>;
		  }
		| Record<string, unknown>;
};

export const ToolsConfigSerializableSchema = z.object({
	activeTool: z.string().nullable(),
	data: z.record(z.string(), z.record(z.string(), z.unknown())).default({})
});
