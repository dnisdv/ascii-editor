import type { ILayerModel, LayerSerializableSchemaType } from '../external';
import type { IEventEmitter } from './event-emitter.type';
import type { ILayer as ILayer, LayerConfig } from './layer.type';
import type { ITileMap } from './tiles.type';
import type { DeepPartial } from './utils.type';

export type LayersManagerIEvents = {
	'layers::active::change': { oldId: string | null; newId: string | null };
	'layer::pre-remove': { layer: ILayer };
	'layer::removed': undefined;
	'layer::updated': {
		before: Partial<ILayerModel>;
		after: Partial<ILayerModel>;
	};
};

export interface ILayersManager extends IEventEmitter<LayersManagerIEvents> {
	addLayer(): [string, ILayer];
	createLayer(params: {
		id: string;
		name: string;
		index: number;
		opts: LayerConfig;
		tileMap: ITileMap;
	}): ILayer;
	addTempLayer(): [string, ILayer];
	removeLayer(key: string): void;
	removeTempLayer(key: string): void;
	getLayer(key: string): ILayer | null;
	getAllVisibleLayers(): ILayer[];
	getAllVisibleLayersSorted(): ILayer[];
	getLayers(): ILayer[];
	insertLayer(id: string, layer: ILayer): void;
	clearLayers(): void;
	getActiveLayerKey(): string | null;
	ensureLayer(): ILayer;
	getActiveLayer(): ILayer | null;

	addLayerSilent(): [string, ILayer];
	setActiveLayer(key: string): void;

	updateLayer(id: string, updates: DeepPartial<ILayerModel>): void;
	updateLayerSilent(id: string, updates: Partial<ILayerModel>): void;

	insertLayerAtIndex(index: number, layer: ILayer): void;
	silentActivateLayer(id: string): void;
	removeLayerSilent(id: string): void;
	getTempLayer(key: string): ILayer | null;
	getCombinedTileData(tileX: number, tileY: number): string;

	deserializeLayer(layer: LayerSerializableSchemaType): ILayer;
}
