import type { ITile, ITileMap, RegionOptions } from './tiles.type';
import type { IEventEmitter } from './event-emitter.type';
import type { ILayerModel, ITileModel } from '../external';
import type { DeepPartial } from './utils.type';

export type LayerConfig = {
	visible: boolean;
	locked: boolean;
};

export type LayerEventMap = {
	changed: undefined;
	updated: { before: ILayerModel; after: ILayerModel };
	tile_changed: ITileModel & { layerId: string };
	tile_deleted: { x: number; y: number; layerId: string };
};

export interface ILayer extends IEventEmitter<LayerEventMap>, ILayerModel {
	id: string;
	tileMap: ITileMap;
	opts: LayerConfig;
	name: string;
	index: number;

	getOpts(): LayerConfig;
	addTile(x: number, y: number): ITile;
	queryTiles(x: number, y: number, width: number, height: number): ITile[];
	queryAllTiles(): ITile[];
	getTileAtPosition(x: number, y: number): ITile | null;
	clear(): void;
	setCharToTile(x: number, y: number, char: string, tile: { x: number; y: number }): void;
	setToRegion(startX: number, startY: number, inputString: string, options?: RegionOptions): void;
	readRegion(startX: number, startY: number, width: number, height: number): string;
	setRegionToTile(
		startX: number,
		startY: number,
		inputString: string,
		tile: { x: number; y: number }
	): void;
	clearRegion(startX: number, startY: number, width: number, height: number): void;
	fillRegionToTile(
		startX: number,
		startY: number,
		width: number,
		height: number,
		char: string,
		tile: { x: number; y: number }
	): void;
	setChar(x: number, y: number, char: string): ITileModel | null;
	getChar(x: number, y: number): string;
	update(updates: DeepPartial<ILayerModel>): { before: ILayerModel; after: ILayerModel };
	updateIndex(newIndex: number): void;
	isEmpty(): boolean;
}
