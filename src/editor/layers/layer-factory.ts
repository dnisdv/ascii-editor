import { defaultLayerConfig, Layer } from './layer';
import { nanoid } from '@reduxjs/toolkit';
import { TileMap } from '@editor/tileMap';
import type { ILayer, ILayerModel, ITileMap } from '@editor/types';
import type { BaseBusLayers } from '@editor/bus-layers';
import type { Config } from '@editor/config';

export interface LayerFactoryOption {
	layersBus: BaseBusLayers;
	config: Config;
}

export class LayerFactory {
	private config: Config;
	private bus: BaseBusLayers;

	constructor({ config, layersBus }: LayerFactoryOption) {
		this.config = config;
		this.bus = layersBus;
	}

	createLayerWithDefaultConfig(): [string, ILayer] {
		const id = nanoid();
		const tileSize = this.config.tileSize;
		const tileMap = new TileMap({ tileSize });

		const layer = new Layer({
			id,
			// TODO USO LAYER_NAME_KEY, let the ui to choose the name
			name: 'Untitled layer',
			index: 0,
			opts: defaultLayerConfig,
			layersBus: this.bus,
			tileMap
		});

		return [id, layer];
	}

	createTempLayer(): [string, ILayer] {
		return this.createLayerWithDefaultConfig();
	}

	newLayer({
		id,
		name,
		opts,
		tileMap,
		index
	}: ILayerModel & { tileMap: ITileMap; config?: Partial<ILayerModel> }): ILayer {
		return new Layer({
			id,
			name,
			opts,
			index,
			tileMap,
			layersBus: this.bus
		});
	}
}
