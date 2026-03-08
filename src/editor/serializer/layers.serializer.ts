import type { LayerSerializer } from '@editor/types';
import type { LayersSerializableSchemaType } from './layers.serializer.schema';
import type { LayersManager } from '@editor/layers/layers-manager';

export class LayersSerializer {
	constructor(
		private layerSerializer: LayerSerializer,
		private layersManager: LayersManager
	) {}

	serialize(): LayersSerializableSchemaType {
		const layersManager = this.layersManager;
		const serialized: LayersSerializableSchemaType = {
			activeLayerKey: this.layersManager.getActiveLayerKey(),
			data: {}
		};

		layersManager.getLayers().forEach((layer) => {
			serialized.data[layer.id] = this.layerSerializer.serialize(layer);
		});
		return serialized;
	}

	deserialize(data: LayersSerializableSchemaType): void {
		const layersManager = this.layersManager;

		layersManager.withSuspended(() => {
			layersManager.clearLayers();
			const layers = Object.values(data.data).map((layerData) =>
				this.layerSerializer.deserialize(layerData)
			);

			layers.forEach((layer) => {
				layersManager['layers'].insertLayerAtIndex(layer, layer.index);
				layersManager['proxyLayerEvents'](layer);
			});

			if (data.activeLayerKey) {
				layersManager['layers'].setActiveLayer(data.activeLayerKey);
			}
		});
	}
}
