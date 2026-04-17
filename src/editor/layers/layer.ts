import { EventEmitter } from '@editor/event-emitter';
import { TextGridObject } from '@editor/objects/text-grid-object';
import { ObjectListManager } from './layer-object-list-manager';

import type { Config } from '@editor/config';
import type { ILayerModel, LayerConfig } from '@editor/types/external/layer-model';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { ObjectHistoryBinder } from './object-history-binder';
import type { LayerEventMap } from '@editor/types/external/layers-events';
import type { DeepPartial, ITileMap, ObjectOperation } from '@editor/types';

export const defaultLayerConfig = {
	visible: true,
	locked: false
};

export interface LayerConstructor {
	id: string;
	name: string;
	index: number;
	opts: Partial<LayerConfig>;
	objects?: ISmartObject[];
	orderKeys?: Record<string, string>;
	config: Config;
	binder?: ObjectHistoryBinder;
	groupId?: string | null;
}

export class Layer extends EventEmitter<LayerEventMap> implements ILayerModel {
	id: string;
	name: string;
	index: number;
	opts: LayerConfig;
	groupId: string | null;
	textGrid: TextGridObject;

	private _objects: ObjectListManager<ISmartObject>;
	private binder?: ObjectHistoryBinder;

	constructor({
		id,
		name,
		opts,
		index,
		objects = [],
		orderKeys,
		config,
		binder,
		groupId = null
	}: LayerConstructor) {
		super();
		this.id = id;
		this.name = name;
		this.index = index;
		this.groupId = groupId;
		this.opts = { ...defaultLayerConfig, ...opts };
		this.binder = binder;

		this._objects = new ObjectListManager(objects, orderKeys, {
			onAdd: this.handleObjectAdded.bind(this),
			onRemove: this.handleObjectRemoved.bind(this),
			onObjectOperation: this.handleObjectOperation.bind(this),
			onObjectUpdate: this.handleObjectUpdate.bind(this),
			onMove: this.handleObjectMoved.bind(this)
		});

		for (const obj of this._objects.getAll()) {
			this.binder?.bind(obj);
		}

		const isTextGrid = objects.find((obj) => obj.type === 'text-grid');

		if (isTextGrid) {
			this.textGrid = isTextGrid as TextGridObject;
		} else {
			this.textGrid = new TextGridObject(config);
		}
	}

	private handleObjectOperation(object: ISmartObject, data: unknown): void {
		this.emit('object::op', {
			operation: data as ObjectOperation,
			objectId: object.id,
			objectType: object.type
		});
	}

	private handleObjectUpdate(): void {
		this.emit('object::update', undefined);
	}

	private handleObjectMoved(id: string, toIndex: number): void {
		const orderKey = this._objects?.getOrderKey(id);
		this.emit('object::moved', { id, toIndex, orderKey });
	}

	private handleObjectAdded(object: ISmartObject, toIndex: number): void {
		this.binder?.bind(object);

		const orderKey = this._objects?.getOrderKey(object.id);
		this.emit('object::added', { object, toIndex, orderKey });
	}

	private handleObjectRemoved(object: ISmartObject): void {
		this.emit('object::removed', { id: object.id });
	}

	get objects(): ISmartObject[] {
		return this._objects.getAll();
	}

	get grid(): TextGridObject {
		return this.textGrid;
	}

	get tileMap(): ITileMap {
		return this.textGrid.getTileMap();
	}

	public removeAllObjects(): void {
		this._objects.clear();
	}

	public moveObject(objectId: string, toIndex: number): void {
		this._objects.updateIndex(objectId, toIndex);
	}

	public addObject(
		object: ISmartObject,
		position?: number | { index?: number; orderKey?: string }
	): void {
		this._objects.add(object, position);
	}

	public addOrReplaceObject(
		object: ISmartObject,
		position?: number | { index?: number; orderKey?: string }
	): void {
		if (this._objects.has(object.id)) {
			this._objects.remove(object.id);
		}
		this._objects.add(object, position);
	}

	public getIndexOfObject(objectId: string): number {
		return this._objects.getIndexOf(objectId);
	}

	public getOrderKey(objectId: string): string | undefined {
		return this._objects.getOrderKey(objectId);
	}

	public removeObject(objectId: string): void {
		this._objects.remove(objectId);
	}

	public getObjects(): ISmartObject[] {
		return this._objects.getAll();
	}

	public getOrderedObjects(): ISmartObject[] {
		return this._objects.getAll();
	}

	public isEmpty(): boolean {
		return (
			this._objects.getAll().filter((obj) => obj.type !== 'text-grid').length === 0 &&
			this.tileMap.isEmpty()
		);
	}

	public getObjectById(objectId: string): ISmartObject | undefined {
		return this._objects.get(objectId);
	}

	public getOpts(): LayerConfig {
		return this.opts;
	}

	public clear(): void {
		this._objects.clear();
	}

	public update(updates: DeepPartial<ILayerModel>) {
		if (updates.name !== undefined) {
			this.name = updates.name;
		}
		if (updates.index !== undefined) {
			this.index = updates.index;
		}
		if (updates.opts) {
			this.opts = { ...defaultLayerConfig, ...this.opts, ...updates.opts };
		}
		if (updates.groupId !== undefined) {
			this.groupId = updates.groupId ?? null;
		}
		this.emit('updated', updates);
	}
}
