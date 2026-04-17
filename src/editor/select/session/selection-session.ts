import { EventEmitter } from '@editor/event-emitter';
import type { Layer } from '@editor/layers/layer';
import type { LayerController } from '@editor/layers/layer-api';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { CellRectangle } from '@editor/types';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import type { LayerEventMap } from '@editor/types/external/layers-events';
import { SelectionStrategyFactory } from './selection-strategies';

export interface SelectedContentEntity {
	region: CellRectangle;
	data: string;
}

export interface SessionSnapshot {
	id: string;
	boundingBox: CellRectangle;
	selectedObjects: SmartObjectSerializableSchemaType[];
	_targetLayerId: string | null;
	_textTargetLayerId?: string | null;
	_sourceLayerId: string | null;
	orderKeys: Record<SmartObjectSerializableSchemaType['id'], string>;
}

export type SessionEventType = {
	'session::changed': { session: SelectionSession };
	'session::committed': { session: SelectionSession };
	'session::cancelled': { session: SelectionSession };
	'object::update': undefined;
};

export interface ISelectionSessionDeps {
	layersManager: LayersManager;
	sourceLayerId?: string | null;
	smartObjectsManager?: SmartObjectsManager;
}

export class SelectionSession extends EventEmitter<SessionEventType> {
	public id: string;

	public boundingBox: CellRectangle = { cellX: 0, cellY: 0, width: 0, height: 0 };

	private _sourceLayerId!: string;
	private _targetLayerId!: string;
	private _textTargetLayerId: string | null = null;

	private layersManager: LayersManager;
	private smartObjectsManager: SmartObjectsManager | null = null;
	private selectionStrategies: SelectionStrategyFactory;

	constructor({ layersManager, sourceLayerId, smartObjectsManager }: ISelectionSessionDeps) {
		super();
		this.layersManager = layersManager;
		this.selectionStrategies = new SelectionStrategyFactory(this);
		this.smartObjectsManager = smartObjectsManager ?? null;
		this.id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
		this._sourceLayerId = sourceLayerId ?? this.layersManager.getActiveLayerKey()!;
		if (!this._sourceLayerId) throw new Error('No active layer');

		this.createObjectsTempLayer();
	}

	private createObjectsTempLayer(): string {
		const sourceApi = this.layersManager.getLayer(this._sourceLayerId);
		if (!sourceApi) throw new Error('No source layer');
		const tempLayerId = sourceApi.createTempLayer();
		const tempLayer = this.layersManager._getTempLayerInternal(tempLayerId);
		tempLayer?.removeAllObjects();

		if (tempLayer)
			this.proxy<LayerEventMap>(tempLayer, {
				events: ['object::op'],
				transform: () => {
					this.onSelectionChange();
					return undefined;
				}
			});
		this._targetLayerId = tempLayerId;
		return tempLayerId;
	}

	private ensureTextOverlayTempLayer(): string {
		if (this._textTargetLayerId) return this._textTargetLayerId;

		const sourceRealLayer = this.layersManager.getRealLayer(this._sourceLayerId);
		const index = sourceRealLayer?.index;
		const [id] = this.layersManager.addOverlayTempLayer(index, this._sourceLayerId);
		const tempLayer = this.layersManager._getTempLayerInternal(id);
		tempLayer?.removeAllObjects();

		if (tempLayer) {
			this.proxy<LayerEventMap>(tempLayer, {
				events: ['object::op'],
				transform: () => {
					this.onSelectionChange();
					return undefined;
				}
			});
		}

		this._textTargetLayerId = id;
		return id;
	}

	public getSourceLayerId(): string {
		return this._sourceLayerId;
	}
	public getTargetLayerId(): string {
		return this._targetLayerId;
	}
	public getTextTargetLayerId(): string | null {
		return this._textTargetLayerId;
	}

	public getTargetLayerIdForObject(obj: ISmartObject): string {
		if (obj.type === 'text-selection') return this.ensureTextOverlayTempLayer();
		return this._targetLayerId;
	}

	public getTargetLayerForObject(obj: ISmartObject): Layer | null {
		const id = this.getTargetLayerIdForObject(obj);
		return this.layersManager._getTempLayerInternal(id);
	}

	public isEmpty(): boolean {
		const objectsLayer = this.getObjectsTargetLayer();
		const textLayer = this.getTextTargetLayer();
		return (
			(objectsLayer?.getObjects().length ?? 0) === 0 && (textLayer?.getObjects().length ?? 0) === 0
		);
	}

	public getTargetLayer(): Layer | null {
		return this.getObjectsTargetLayer();
	}

	public getObjectsTargetLayer(): Layer | null {
		return this.layersManager._getTempLayerInternal(this._targetLayerId);
	}

	public getTextTargetLayer(): Layer | null {
		if (!this._textTargetLayerId) return null;
		return this.layersManager._getTempLayerInternal(this._textTargetLayerId);
	}

	public getSourceLayer(): LayerController {
		const sourceLayer = this.layersManager.getLayer(this._sourceLayerId);
		if (!sourceLayer) throw new Error('No source layer in selection session');
		return sourceLayer;
	}

	public getSelectedObjects(): ISmartObject[] {
		const objectsLayer = this.getObjectsTargetLayer();
		const textLayer = this.getTextTargetLayer();
		const combined = [...(objectsLayer?.getObjects() ?? []), ...(textLayer?.getObjects() ?? [])];

		const byId = new Map<string, ISmartObject>();
		for (const obj of combined) byId.set(obj.id, obj);
		return Array.from(byId.values());
	}

	public getObjectById(id: string): ISmartObject | null {
		const objectsLayer = this.getObjectsTargetLayer();
		const textLayer = this.getTextTargetLayer();
		return objectsLayer?.getObjectById(id) ?? textLayer?.getObjectById(id) ?? null;
	}

	public hasObject(id: string): boolean {
		return !!this.getObjectById(id);
	}

	public getObjectsByType(type: string): ISmartObject[] {
		return this.getSelectedObjects().filter((obj) => obj.type === type);
	}

	public setObjects(objects: ISmartObject[]): void {
		this.clearObjects();
		this.addObjects(objects);
	}

	public replaceObject(objectID: string, object: ISmartObject): void {
		const objectsLayer = this.getObjectsTargetLayer();
		const textLayer = this.getTextTargetLayer();
		const nextLayer =
			object.type === 'text-selection'
				? (this.getTextTargetLayer() ??
					this.layersManager._getTempLayerInternal(this.ensureTextOverlayTempLayer()))
				: objectsLayer;
		if (!nextLayer) return;

		type WithOrderKey = { orderKey?: string };
		const serialized = object.serialize() as unknown as WithOrderKey;
		const existingOrderKey =
			objectsLayer?.getOrderKey(objectID) ?? textLayer?.getOrderKey(objectID);
		const orderKey = existingOrderKey ?? serialized.orderKey;

		objectsLayer?.removeObject(objectID);
		textLayer?.removeObject(objectID);

		const position = orderKey ? { orderKey } : undefined;
		nextLayer.addObject(object, position);

		this.onSelectionChange();
	}

	public addObjects(objects: ISmartObject[], options?: { clearRegion?: boolean }): void {
		for (let i = objects.length - 1; i >= 0; i--) {
			const obj = objects[i];
			this._strategy(obj).select(obj, options);
		}
		this.onSelectionChange();
	}

	public removeObjects(objectsIds: string[]): void {
		objectsIds.forEach((obj) => {
			const object = this.getObjectById(obj);
			if (!object) return;
			this._strategy(object).remove(object);
		});

		this.onSelectionChange();
	}

	public clearObjects(): void {
		this.getSelectedObjects().forEach((obj) => this._strategy(obj).remove(obj));

		this.onSelectionChange();
	}

	public commitObjects(objectIds: string[]): void {
		objectIds.forEach((id) => {
			const obj = this.getObjectById(id);
			if (!obj) return;
			this._strategy(obj).commit(obj);
		});

		this.onSelectionChange();
	}

	public removeObjectsFromTemp(objectIds: string[]): void {
		objectIds.forEach((id) => {
			const obj = this.getObjectById(id);
			if (!obj) return;
			this._strategy(obj).cancel(obj);
		});

		this.onSelectionChange();
	}

	private onSelectionChange(): void {
		this.recalculateBoundingBox();
		this.emit('session::changed', { session: this });
	}

	public commit(): void {
		if (!this.layersManager.getLayer(this._sourceLayerId)) {
			this.cleanup();
			this.emit('session::cancelled', { session: this });
			return;
		}

		this.getSelectedObjects().forEach((obj) => this._strategy(obj).commit(obj));

		this.cleanup();
		this.emit('session::committed', { session: this });
	}

	public remove(): void {
		this.getSelectedObjects().forEach((obj) => this._strategy(obj).remove(obj));

		this.cleanup();
		this.emit('session::committed', { session: this });
	}

	public commitObject(objectId: string): void {
		const foundObj = this.getObjectById(objectId);
		if (!foundObj) return;

		this._strategy(foundObj).commit(foundObj);

		if (this.isEmpty()) {
			this.cleanup();
			this.emit('session::committed', { session: this });
			return;
		}

		this.onSelectionChange();
	}

	public cancel(): void {
		this.getSelectedObjects().forEach((obj) => this._strategy(obj).cancel(obj));

		this.cleanup();
		this.emit('session::cancelled', { session: this });
	}

	public cancelObject(objectId: string): void {
		const foundObj = this.getObjectById(objectId);
		if (!foundObj) return;

		this._strategy(foundObj).cancel(this.getObjectById(objectId)!);
		this.onSelectionChange();
	}

	private cleanup(): void {
		if (this._targetLayerId) {
			const layer = this.layersManager._getTempLayerInternal(this._targetLayerId);
			if (layer) this.unproxy<LayerEventMap>(layer);
			this.layersManager.removeTempLayer(this._targetLayerId);
		}
		if (this._textTargetLayerId) {
			const layer = this.layersManager._getTempLayerInternal(this._textTargetLayerId);
			if (layer) this.unproxy<LayerEventMap>(layer);
			this.layersManager.removeTempLayer(this._textTargetLayerId);
			this._textTargetLayerId = null;
		}
	}

	public serialize(): SessionSnapshot {
		const objectsLayer = this.getObjectsTargetLayer();
		if (!objectsLayer) throw new Error('Cannot serialize session without an objects temp layer.');
		const textLayer = this.getTextTargetLayer();
		const selected = this.getSelectedObjects();

		const orderKeys: Record<string, string> = {};
		const serializedObjects = selected.map((obj) => {
			const key = objectsLayer.getOrderKey(obj.id) ?? textLayer?.getOrderKey(obj.id) ?? '';
			orderKeys[obj.id] = key || '';
			return obj.serialize();
		});

		return JSON.parse(
			JSON.stringify({
				id: this.id,
				boundingBox: this.boundingBox,
				selectedObjects: serializedObjects,
				_sourceLayerId: this._sourceLayerId,
				_targetLayerId: this._targetLayerId,
				_textTargetLayerId: this._textTargetLayerId,
				orderKeys: orderKeys
			})
		);
	}

	public static fromSnapshot(
		snapshot: SessionSnapshot,
		deps: ISelectionSessionDeps
	): SelectionSession {
		if (!snapshot._sourceLayerId) throw new Error('Snapshot missing source layer ID');

		const session = new SelectionSession({ ...deps, sourceLayerId: snapshot._sourceLayerId });
		session.id = snapshot.id;
		session._sourceLayerId = snapshot._sourceLayerId;

		const objectsToSet = SelectionSession.deserializeObjects(
			snapshot.selectedObjects,
			session.smartObjectsManager
		);

		session._clearTempObjects();

		objectsToSet.forEach((obj) => session._addObjectsLiteral([obj], snapshot.orderKeys));

		session.boundingBox = snapshot.boundingBox;

		return session;
	}

	private _clearTempObjects(): void {
		const objectsTarget = this.getObjectsTargetLayer();
		const textTarget = this.getTextTargetLayer();
		for (const target of [objectsTarget, textTarget]) {
			if (!target) continue;
			const objs = target.getObjects();
			for (const o of objs) target.removeObject(o.id);
		}
		this.onSelectionChange();
	}

	private _addObjectsLiteral(objects: ISmartObject[], orderKeys?: Record<string, string>): void {
		if (objects.length === 0) return;

		for (const obj of objects) {
			const target =
				obj.type === 'text-selection'
					? (this.getTextTargetLayer() ??
						this.layersManager._getTempLayerInternal(this.ensureTextOverlayTempLayer()))
					: this.getObjectsTargetLayer();
			if (!target) continue;
			const key = orderKeys?.[obj.id];
			const position = key ? { orderKey: key } : undefined;
			target.addObject(obj, position);
		}
		this.onSelectionChange();
	}

	private static deserializeObjects(
		serializedObjects: SmartObjectSerializableSchemaType[] | undefined,
		manager: SmartObjectsManager | null
	): ISmartObject[] {
		if (!serializedObjects || !manager) {
			if (!manager) console.warn('SmartObjectsManager not available, cannot deserialize objects');
			return [];
		}

		return serializedObjects
			.map((serializedObj) => {
				try {
					const copy = JSON.parse(JSON.stringify(serializedObj));
					delete copy.index;
					return manager.createObject(copy.type, copy);
				} catch (e) {
					console.warn(`Failed to deserialize object of type ${serializedObj.type}:`, e);
					return null;
				}
			})
			.filter((obj): obj is ISmartObject => obj !== null);
	}

	public recalculateBoundingBox(): void {
		if (this.isEmpty()) {
			this.boundingBox = { cellX: 0, cellY: 0, width: 0, height: 0 };
			return;
		}

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		this.getSelectedObjects().forEach((obj) => {
			const cellX = Number(obj.getProperty('transform.x'));
			const cellY = Number(obj.getProperty('transform.y'));
			const width = Number(obj.getProperty('transform.width'));
			const height = Number(obj.getProperty('transform.height'));

			minX = Math.min(minX, cellX);
			minY = Math.min(minY, cellY);
			maxX = Math.max(maxX, cellX + width);
			maxY = Math.max(maxY, cellY + height);
		});

		this.boundingBox = { cellX: minX, cellY: minY, width: maxX - minX, height: maxY - minY };
	}

	private _strategy(obj: ISmartObject) {
		return this.selectionStrategies.getStrategy(obj);
	}
}
