import { z } from 'zod';
import { CameraSerializableSchema } from './camera.serializer.schema';
import { ConfigSerializableSchema } from './config.serializer.schema';
import { LayersSerializableSchema } from './layers.serializer.schema';
import { ToolsConfigSerializableSchema } from './tools.serializer.schema';

export type DocumentMetaData = {
	id: string;
	version: string;
	title: string;
};

export const DocumentSchema = z.object({
	meta: z.object({
		id: z.string(),
		version: z.string(),
		title: z.string()
	}),
	config: ConfigSerializableSchema,
	layers: LayersSerializableSchema,
	camera: CameraSerializableSchema,
	tools: ToolsConfigSerializableSchema,
	history: z.any()
});

export type DocumentSchemaType = z.infer<typeof DocumentSchema>;
