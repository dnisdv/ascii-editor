// @ts-no-check
/* eslint-disable */

import type {
	ILayerModel,
	DeepPartial,
	ITile,
	LayerConfig,
	ITileMap,
	ITileModel,
	ILayer,
	RegionOptions,
	LayerEventMap
} from '@editor/types';
import type { Layer } from './layer';
import type { LayersManager } from './layers-manager';

export class LayerApi implements ILayer {
	constructor(
		private realLayer: Layer,
		private layersManager: LayersManager
	) {}

	get id(): string {
		return this.realLayer.id;
	}
	get name(): string {
		return this.realLayer.name;
	}
	set name(value: string) {
		this.realLayer.name = value;
	}
	get index(): number {
		return this.realLayer.index;
	}
	get opts(): LayerConfig {
		return this.realLayer.opts;
	}
	get tileMap(): ITileMap {
		return this.realLayer.tileMap;
	}

	setChar = (x: number, y: number, char: string): ITileModel | null =>
		this.realLayer.setChar(x, y, char);
	update = (updates: DeepPartial<ILayerModel>): { before: ILayerModel; after: ILayerModel } =>
		this.realLayer.update(updates);
	addTile = (x: number, y: number): ITile => this.realLayer.addTile(x, y);
	clear = (): void => this.realLayer.clear();
	getOpts = (): LayerConfig => this.realLayer.getOpts();
	queryTiles = (x: number, y: number, width: number, height: number): ITile[] =>
		this.realLayer.queryTiles(x, y, width, height);
	queryAllTiles = (): ITile[] => this.realLayer.queryAllTiles();
	getTileAtPosition = (x: number, y: number): ITile | null => this.getTileAtPosition(x, y);
	setCharToTile = (x: number, y: number, char: string, tile: { x: number; y: number }): void =>
		this.realLayer.setCharToTile(x, y, char, tile);
	setToRegion = (
		startX: number,
		startY: number,
		inputString: string,
		options?: RegionOptions
	): void => this.realLayer.setToRegion(startX, startY, inputString, options);
	readRegion = (startX: number, startY: number, width: number, height: number): string =>
		this.realLayer.readRegion(startX, startY, width, height);
	setRegionToTile = (
		startX: number,
		startY: number,
		inputString: string,
		tile: { x: number; y: number }
	): void => this.setRegionToTile(startX, startY, inputString, tile);
	clearRegion = (startX: number, startY: number, width: number, height: number): void =>
		this.realLayer.clearRegion(startX, startY, width, height);
	fillRegionToTile = (
		startX: number,
		startY: number,
		width: number,
		height: number,
		char: string,
		tile: { x: number; y: number }
	): void => this.realLayer.fillRegionToTile(startX, startY, width, height, char, tile);
	updateIndex = (newIndex: number): void => this.realLayer.updateIndex(newIndex);

	getChar = (x: number, y: number): string => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);

		for (let i = composition.length - 1; i >= 0; i--) {
			const layer = composition[i] as Layer;
			const char = layer.getChar(x, y);
			if (char && char.trim() !== '') {
				return char;
			}
		}
		return ' ';
	};

	isEmpty = (): boolean => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		const isEveryEmpty = composition.every((layer) => layer.isEmpty());
		return isEveryEmpty;
	};

	// :TODO: DEFINE TYPES; REFACTOR A LITTLE;

	on = <K extends keyof LayerEventMap>(
		event: K,
		fn: (data: LayerEventMap[K], meta?: any) => void,
		context?: any
	): this => {
		this.realLayer.on(event, fn, context);
		return this;
	};

	once = <K extends keyof LayerEventMap>(
		event: K,
		fn: (data: LayerEventMap[K], meta?: any) => void,
		context?: any
	): this => {
		this.realLayer.once(event, fn, context);
		return this;
	};

	off = <K extends keyof LayerEventMap>(
		event: K,
		fn?: (data: LayerEventMap[K], meta?: any) => void,
		context?: any
	): this => {
		this.realLayer.off(event, fn, context);
		return this;
	};

	emit = <K extends keyof LayerEventMap>(
		event: K,
		data?: LayerEventMap[K],
		meta?: any
	): boolean => {
		return this.realLayer.emit(event, data, meta);
	};

	listenerCount = (event: keyof LayerEventMap): number => this.realLayer.listenerCount(event);

	listeners = <K extends keyof LayerEventMap>(
		event: K
	): Array<(data: LayerEventMap[K], meta?: any) => void> => this.realLayer.listeners(event);
}
