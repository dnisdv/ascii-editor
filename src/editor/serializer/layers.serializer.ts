import type { ITileMap } from '@editor/types';
import type { LayersSerializableSchemaType } from './layers.serializer.schema';
import { TileMap } from '@editor/tileMap';
import type { CoreApi } from '@editor/core';
import type { LayersManager } from '@editor/layers/layers-manager';

export class LayersSerializer {
	constructor(
		private layersManager: LayersManager,
		private coreApi: CoreApi
	) {}

	serialize(): LayersSerializableSchemaType {
		const serialized: LayersSerializableSchemaType = {
			activeLayerKey: this.layersManager.getActiveLayerKey(),
			data: {}
		};

		this.layersManager.getLayers().forEach((layer) => {
			serialized.data[layer.id] = {
				id: layer.id,
				name: layer.name,
				tileMap: layer.tileMap.serialize(),
				index: layer.index,
				opts: layer.opts
			};
		});

		return serialized;
	}

	deserialize(data: LayersSerializableSchemaType): void {
		this.layersManager.clearLayers();

		const layers = Object.entries(data.data).map(([id, layerData]) => {
			let tileMap: ITileMap;

			if (layerData.tileMap) {
				tileMap = TileMap.deserialize(layerData.tileMap);
			} else {
				tileMap = new TileMap({ tileSize: 25 });
			}

			const layer = this.layersManager.createLayer({
				id,
				name: layerData.name,
				index: layerData.index,
				opts: layerData.opts,
				tileMap
			});

			this.layersManager.insertLayerAtIndex(layer.index, layer);

			return layer;
		});

		if (data.activeLayerKey) {
			this.layersManager['layers'].setActiveLayer(data.activeLayerKey);
			this.layersManager
				.getBus()
				.emit('layer::change_active::response', { id: data.activeLayerKey });
		}

		const _layers = layers.map((i) => ({
			opts: i.opts,
			name: i.name,
			index: i.index,
			id: i.id
		}));

		this.coreApi.getBusManager().layers.emit('layer::tile::change');

		this.coreApi
			.getBusManager()
			.layers.emit('layers::create::response', _layers, { reason: 'hydratation' });
	}
}
