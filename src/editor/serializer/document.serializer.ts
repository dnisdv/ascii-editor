import { LayersSerializer } from './layers.serializer';
import { CameraSerializer } from './camera.serializer';
import { DocumentSchema, type DocumentSchemaType } from './document.serializer.schema';
import { ConfigSerializer } from './config.serializer';
import { ToolsConfigSerializer } from './tools.serializer';
import { LayerSerializer } from './layer.serializer';

export type AppSerializerDeps = {
	layerSerializer: LayerSerializer;
	layersSerializer: LayersSerializer;
	cameraSerializer: CameraSerializer;
	configSerializer: ConfigSerializer;
	toolsConfigSerializer: ToolsConfigSerializer;
};

export class AppSerializer {
	public layersSerializer: LayersSerializer;
	public cameraSerializer: CameraSerializer;
	public configSerializer: ConfigSerializer;
	public toolsConfigSerializer: ToolsConfigSerializer;
	public layerSerializer: LayerSerializer;

	constructor(deps: AppSerializerDeps) {
		this.layersSerializer = deps.layersSerializer;
		this.cameraSerializer = deps.cameraSerializer;
		this.configSerializer = deps.configSerializer;
		this.toolsConfigSerializer = deps.toolsConfigSerializer;
		this.layerSerializer = deps.layerSerializer;
	}

	serialize(): DocumentSchemaType {
		return {
			meta: {
				id: '1',
				title: 'DEFAULT DOCUMENT',
				version: '2.0'
			},
			config: this.configSerializer.serialize(),
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
	}
}
