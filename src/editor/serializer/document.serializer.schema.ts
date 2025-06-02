import { z } from 'zod';
import {
	CameraSerializableSchema,
	type CameraSerializableSchemaType
} from './camera.serializer.schema';
import {
	ConfigSerializableSchema,
	type ConfigSerializableSchemaType
} from './config.serializer.schema';
import type { HistoryManagerSerializableSchemaType } from './historyManager.serializer.schema';
import {
	LayersSerializableSchema,
	type LayersSerializableSchemaType
} from './layers.serializer.schema';
import {
	ToolsConfigSerializableSchema,
	type ToolsConfigSerializableSchemaType
} from './tools.serializer.schema';

export type DocumentMetaData = {
	id: string;
	version: string;
	title: string;
};

export type DocumentSchemaType = {
	meta: DocumentMetaData;
	config: ConfigSerializableSchemaType;
	layers: LayersSerializableSchemaType;
	camera: CameraSerializableSchemaType;
	history: HistoryManagerSerializableSchemaType;
	tools: ToolsConfigSerializableSchemaType;
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
