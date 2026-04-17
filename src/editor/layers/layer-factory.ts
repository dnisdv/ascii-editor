import { defaultLayerConfig, Layer } from './layer';
import { nanoid } from '@reduxjs/toolkit';
import type { Config } from '@editor/config';
import type { ObjectHistoryBinder } from './object-history-binder';
import type { ILayerModel } from '@editor/types/external/layer-model';

export interface LayerFactoryOption {
	config: Config;
	objectHistoryBinder?: ObjectHistoryBinder;
}

export class LayerFactory {
	private config: Config;
	private binder?: ObjectHistoryBinder;

	constructor({ config, objectHistoryBinder }: LayerFactoryOption) {
		this.config = config;
		this.binder = objectHistoryBinder;
	}

	createLayerWithDefaultConfig(): [string, Layer] {
		const id = nanoid();

		const layer = new Layer({
			id,
			// TODO USO LAYER_NAME_KEY, let the ui to choose the name
			name: 'Untitled layer',
			index: 0,
			opts: defaultLayerConfig,
			config: this.config,
			binder: this.binder
		});

		layer.addObject(layer.grid);

		return [id, layer];
	}

	createTempLayer(): [string, Layer] {
		const id = nanoid();

		const layer = new Layer({
			id,
			name: 'Temp layer',
			index: 0,
			opts: defaultLayerConfig,
			config: this.config,
			binder: this.binder
		});

		layer.addObject(layer.grid);

		return [id, layer];
	}

	newLayer({ id, name, opts, index, groupId }: ILayerModel & { config?: Partial<ILayerModel> }): Layer {
		const layer = new Layer({ id, name, opts, index, groupId, config: this.config, binder: this.binder });
		layer.addObject(layer.grid);
		return layer;
	}
}
