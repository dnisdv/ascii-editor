import type { LayerApi } from '@editor/layers/layer-api';
import type { ILayerModel, LayerSerializableSchemaType } from '../external';
import type { IEventEmitter } from './event-emitter.type';
import type { ILayer as ILayer, LayerConfig } from './layer.type';
import type { ITileMap } from './tiles.type';
import type { DeepPartial } from './utils.type';

export type LayersManagerIEvents = {
	'layers::active::change': { oldId: string | null; newId: string | null };
	'layer::content::updated': undefined;

	'layer::remove::before': { layer: ILayer };
	'layer::remove::after': { layerId: string };

	'layer::update::model': {
		layerId: string;
		before: Partial<ILayerModel>;
		after: Partial<ILayerModel>;
	};
};

export interface ILayersManager extends IEventEmitter<LayersManagerIEvents> {
	addLayer(): [string, LayerApi];
	createLayer(params: {
		id: string;
		name: string;
		index: number;
		opts: LayerConfig;
		tileMap: ITileMap;
	}): ILayer;
	addTempLayer(sourceLayerId?: string): [string, ILayer];
	removeLayer(key: string): void;
	removeTempLayer(key: string): void;
	getLayer(key: string): LayerApi | null;
	getAllVisibleLayers(): ILayer[];
	getAllVisibleLayersSorted(): ILayer[];
	getLayers(): ILayer[];
	insertLayer(id: string, layer: ILayer): void;
	clearLayers(): void;
	getActiveLayerKey(): string | null;
	ensureLayer(): LayerApi;
	getActiveLayer(): LayerApi | null;
	setActiveLayer(key: string): void;
	updateLayer(id: string, updates: DeepPartial<ILayerModel>): void;
	insertLayerAtIndex(index: number, layer: ILayer): void;
	getTempLayer(key: string): ILayer | null;
	getCombinedTileData(tileX: number, tileY: number): string;
	deserializeLayer(layer: LayerSerializableSchemaType): ILayer;
	getLayerComposition(layerId: string): ILayer[];
}
