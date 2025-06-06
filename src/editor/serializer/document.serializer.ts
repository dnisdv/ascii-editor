import { LayersSerializer } from './layers.serializer';
import { CameraSerializer } from './camera.serializer';
import { DocumentSchema, type DocumentSchemaType } from './document.serializer.schema';
import { ConfigSerializer } from './config.serializer';
import { ToolsConfigSerializer } from './tools.serializer';
import type { CoreApi } from '@editor/core';
import type { LayersManager } from '@editor/layers/layers-manager';

export class AppSerializer {
	private layersSerializer: LayersSerializer;
	private cameraSerializer: CameraSerializer;
	private configSerializer: ConfigSerializer;
	private toolsConfigSerializer: ToolsConfigSerializer;

	constructor(private core: CoreApi) {
		this.layersSerializer = new LayersSerializer(
			this.core.getLayersManager() as LayersManager,
			this.core
		);
		this.cameraSerializer = new CameraSerializer(this.core.getCamera());
		this.configSerializer = new ConfigSerializer(this.core.getConfig());
		this.toolsConfigSerializer = new ToolsConfigSerializer(this.core.getToolManager());
	}

	serialize(): DocumentSchemaType {
		return {
			meta: {
				id: '1',
				title: 'DEFAULT DOCUMENT',
				version: '1.0'
			},
			config: {
				tileSize: 25
			},
			tools: this.toolsConfigSerializer.serialize(),
			layers: this.layersSerializer.serialize(),
			camera: this.cameraSerializer.serialize(),
			history: null
		};
	}

	deserialize(data: DocumentSchemaType): void {
		const validationResult = DocumentSchema.safeParse(data);

		if (!validationResult.success) {
			console.error('Deserialization failed:', validationResult.error);
			throw new Error('Invalid document schema');
		}
		const validData = validationResult.data;

		this.layersSerializer.deserialize(validData.layers);
		this.configSerializer.deserialize(validData.config);
		this.toolsConfigSerializer.deserialize(validData.tools);

		this.core.render();
	}
}
