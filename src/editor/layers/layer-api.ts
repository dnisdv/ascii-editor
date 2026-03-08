import type { ITileMap, LayerEventMap, MetaData } from '@editor/types';
import {
	compareFractionalIndex,
	generateKeyForIndex,
	generateKeyBetween
} from '@editor/utils/fractional-index';
import type { Layer } from './layer';
import type { LayersManager } from './layers-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { TextGridObject } from '@editor/objects/text-grid-object';
import type { ILayerModel, LayerConfig } from '@editor/types/external/layer-model';
import type { ObjectPosition } from './layer-object-list-manager';

export class LayerController implements ILayerModel {
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
	get objects(): ISmartObject[] {
		return this.realLayer.objects;
	}
	get grid(): TextGridObject {
		return this.realLayer.grid;
	}

	getOpts = (): LayerConfig => this.realLayer.getOpts();
	addObject = (object: ISmartObject, position?: ObjectPosition): void =>
		this.realLayer.addObject(object, position);
	addOrReplaceObject = (object: ISmartObject, position?: ObjectPosition): void =>
		this.realLayer.addOrReplaceObject(object, position);
	removeObject = (objectId: string): void => this.realLayer.removeObject(objectId);
	update = (updates: Partial<ILayerModel>) =>
		this.layersManager.updateLayer(this.realLayer.id, updates);

	getObjects = (): ISmartObject[] => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);

		const byId: Map<string, { obj: ISmartObject; orderKey?: string; seq: number }> = new Map();
		let seq = 0;
		for (const layer of composition) {
			const objs = layer.getObjects();
			for (const obj of objs) {
				byId.set(obj.id, { obj, orderKey: layer.getOrderKey(obj.id), seq: seq++ });
			}
		}

		const items = Array.from(byId.values());

		items.sort((a, b) => {
			const ak = a.orderKey;
			const bk = b.orderKey;
			const ahas = typeof ak === 'string';
			const bhas = typeof bk === 'string';
			if (ahas && bhas) return compareFractionalIndex(ak as string, bk as string);
			if (ahas && !bhas) return -1;
			if (!ahas && bhas) return 1;
			return a.seq - b.seq;
		});

		return items.map((i) => i.obj);
	};

	getObjectById = (objectId: string): ISmartObject | undefined => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		for (let i = composition.length - 1; i >= 0; i--) {
			const obj = composition[i].getObjectById(objectId);
			if (obj) return obj;
		}
		return undefined;
	};

	getIndexOfObject = (objectId: string): number => {
		const objs = this.getObjects();
		return objs.findIndex((o) => o.id === objectId);
	};

	getOrderKey = (objectId: string): string | undefined => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		for (let i = composition.length - 1; i >= 0; i--) {
			const key = composition[i].getOrderKey(objectId);
			if (typeof key === 'string') return key;
		}
		return undefined;
	};

	moveObject = (objectId: string, toIndex: number): void => {
		const composed = this.getObjects();
		const ids = composed.map((o) => o.id);
		const newKey = generateKeyForIndex(toIndex, ids, (id) => this.getOrderKey(id), objectId);

		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		for (let i = composition.length - 1; i >= 0; i--) {
			const layer = composition[i];
			const obj = layer.getObjectById(objectId);
			if (obj) {
				layer.addOrReplaceObject(obj, { orderKey: newKey });
				const isTemp = !!this.layersManager._getTempLayerInternal(layer.id);
				this.layersManager.emit(isTemp ? 'temp_layer::object::moved' : 'layer::object::moved', {
					layerId: this.realLayer.id,
					id: objectId,
					toIndex
				});
				return;
			}
		}
	};

	getComposedIds = (): string[] => this.getObjects().map((o) => o.id);
	getComposedKey = (id: string): string | undefined => this.getOrderKey(id);
	getKeyForIndex = (toIndex: number, excludeId?: string): string => {
		const ids = this.getComposedIds();
		return generateKeyForIndex(toIndex, ids, (id) => this.getOrderKey(id), excludeId);
	};

	createTempLayer = (): string => {
		const [id] = this.layersManager._attachTempLayerInternal(this.realLayer.id);
		return id;
	};

	disposeTempLayer = (tempLayerId: string): void => {
		const attached = this.layersManager.getAttachedTempLayers(this.realLayer.id);
		if (!attached.includes(tempLayerId)) return;
		this.layersManager.removeTempLayer(tempLayerId);
	};

	getAttachedTempLayers = (): string[] =>
		this.layersManager.getAttachedTempLayers(this.realLayer.id);

	insertObjectInTempAtTop = (tempLayerId: string, object: ISmartObject): void => {
		if (!this.getAttachedTempLayers().includes(tempLayerId)) return;
		const key = this.getKeyForIndex(0);
		const temp = this.layersManager._getTempLayerInternal(tempLayerId);
		if (temp) temp.addOrReplaceObject(object, { orderKey: key });
	};

	insertObjectInTempUsingSourceKeyOrTop = (tempLayerId: string, object: ISmartObject): void => {
		if (!this.getAttachedTempLayers().includes(tempLayerId)) return;
		const temp = this.layersManager._getTempLayerInternal(tempLayerId);
		if (!temp) return;
		const sourceKey = this.realLayer.getOrderKey(object.id);
		const key = sourceKey ?? this.getKeyForIndex(0);
		temp.addOrReplaceObject(object, { orderKey: key });
	};

	insertObjectInTempAtEnd = (tempLayerId: string, object: ISmartObject): void => {
		if (!this.getAttachedTempLayers().includes(tempLayerId)) return;
		const ids = this.getComposedIds();

		let endIndex = Math.max(0, ids.length - 1);

		const lastId = ids[ids.length - 1];
		const lastKey = lastId ? this.getOrderKey(lastId) : undefined;
		if (!lastKey && ids.length > 1) endIndex = ids.length - 2;

		const key = this.getKeyForIndex(endIndex);
		const temp = this.layersManager._getTempLayerInternal(tempLayerId);
		if (temp) temp.addOrReplaceObject(object, { orderKey: key });
	};

	insertObjectInTempBetween = (
		tempLayerId: string,
		prevId: string,
		nextId: string,
		object: ISmartObject
	): void => {
		if (!this.getAttachedTempLayers().includes(tempLayerId)) return;
		const prevKey = this.getOrderKey(prevId);
		const nextKey = this.getOrderKey(nextId);

		const key = prevKey && nextKey ? generateKeyBetween(prevKey, nextKey) : this.getKeyForIndex(0);
		const temp = this.layersManager._getTempLayerInternal(tempLayerId);

		if (temp) temp.addOrReplaceObject(object, { orderKey: key });
	};

	insertTempAtTop = (tempLayerId: string, object: ISmartObject): void =>
		this.insertObjectInTempAtTop(tempLayerId, object);
	insertTempAtEnd = (tempLayerId: string, object: ISmartObject): void =>
		this.insertObjectInTempAtEnd(tempLayerId, object);
	insertTempBetween = (
		tempLayerId: string,
		prevId: string,
		nextId: string,
		object: ISmartObject
	): void => this.insertObjectInTempBetween(tempLayerId, prevId, nextId, object);
	insertTempUsingSourceKeyOrTop = (tempLayerId: string, object: ISmartObject): void =>
		this.insertObjectInTempUsingSourceKeyOrTop(tempLayerId, object);

	getOrderedObjects = (): ISmartObject[] => this.getObjects();
	removeAllObjects = (): void => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		for (const layer of composition) {
			layer.removeAllObjects();
		}
	};

	isEmpty = (): boolean => {
		const composition = this.layersManager.getLayerComposition(this.realLayer.id);
		const isEveryEmpty = composition.every((layer) => layer.isEmpty());
		return isEveryEmpty;
	};

	on = <K extends keyof LayerEventMap>(
		event: K,
		fn: (data: LayerEventMap[K], meta?: MetaData) => void,
		context?: MetaData
	): this => {
		this.realLayer.on(event, fn, context);
		return this;
	};

	once = <K extends keyof LayerEventMap>(
		event: K,
		fn: (data: LayerEventMap[K], meta?: MetaData) => void,
		context?: MetaData
	): this => {
		this.realLayer.once(event, fn, context);
		return this;
	};

	off = <K extends keyof LayerEventMap>(
		event: K,
		fn?: (data: LayerEventMap[K], meta?: MetaData) => void,
		context?: MetaData
	): this => {
		this.realLayer.off(event, fn, context);
		return this;
	};

	emit = <K extends keyof LayerEventMap>(
		event: K,
		data?: LayerEventMap[K],
		meta?: MetaData
	): boolean => {
		return this.realLayer.emit(event, data, meta);
	};

	listenerCount = (event: keyof LayerEventMap): number => this.realLayer.listenerCount(event);

	listeners = <K extends keyof LayerEventMap>(
		event: K
	): Array<(data: LayerEventMap[K], meta?: MetaData) => void> => this.realLayer.listeners(event);

	getChar(x: number, y: number): string {
		return this.realLayer.grid.getChar(x, y);
	}

	setChar(x: number, y: number, char: string): void {
		this.realLayer.grid.setChar(x, y, char);
	}

	setToRegion(cellX: number, cellY: number, content: string): void {
		this.realLayer.grid.setToRegion(cellX, cellY, content);
	}

	readRegion(startX: number, startY: number, width: number, height: number): string {
		return this.realLayer.grid.readRegion(startX, startY, width, height);
	}
}
