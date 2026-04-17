import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import type { LayerGroupSerializableSchemaType } from '@editor/serializer/group.serializer.schema';
import {
	DocumentSchema,
	LayerSerializableSchema,
	type DocumentSchemaType,
	type LayerSerializableSchemaType,
	type ObjectOperation
} from '@editor/types';

import {
	compareFractionalIndex,
	generateKeyForIndex,
	resolveCollision
} from '@editor/utils/fractional-index';

export class DocumentController {
	private schema: DocumentSchemaType;

	private clampIndex(index: number, min: number, max: number): number {
		if (!Number.isFinite(index)) return min;
		return Math.max(min, Math.min(index, max));
	}

	private ensureLayerOrderingState(layer: LayerSerializableSchemaType): void {
		if (!Array.isArray(layer.objectOrder)) layer.objectOrder = [];
		if (!layer.orderKeys) layer.orderKeys = {};
	}

	private normalizeObjectOrdering(layer: LayerSerializableSchemaType): void {
		this.ensureLayerOrderingState(layer);

		const objects = layer.objects;
		const orderKeys: Record<string, string> = layer.orderKeys ?? {};

		for (const id of Object.keys(orderKeys)) {
			if (!objects[id]) delete orderKeys[id];
		}

		const currentOrder = Array.isArray(layer.objectOrder) ? layer.objectOrder.slice() : [];
		const currentIndex = new Map<string, number>();
		for (let i = 0; i < currentOrder.length; i++) currentIndex.set(currentOrder[i], i);

		const allIds = Object.keys(objects);
		allIds.sort((a, b) => {
			const ak = orderKeys[a];
			const bk = orderKeys[b];
			const ahas = typeof ak === 'string' && ak.length > 0;
			const bhas = typeof bk === 'string' && bk.length > 0;
			if (ahas && bhas) return compareFractionalIndex(ak, bk);
			if (ahas && !bhas) return -1;
			if (!ahas && bhas) return 1;
			return (
				(currentIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
				(currentIndex.get(b) ?? Number.MAX_SAFE_INTEGER)
			);
		});

		layer.objectOrder = allIds;
		layer.orderKeys = orderKeys;
	}

	private generateOrderKeyForIndex(
		layer: LayerSerializableSchemaType,
		toIndex: number,
		excludeId?: string
	): string {
		this.ensureLayerOrderingState(layer);
		const orderKeys: Record<string, string> = layer.orderKeys ?? {};
		const ids = (layer.objectOrder ?? []).filter((id) => id !== excludeId && !!layer.objects?.[id]);
		const clampedIndex = this.clampIndex(toIndex, 0, ids.length);
		const generatedKey = generateKeyForIndex(clampedIndex, ids, (id) => orderKeys[id], excludeId);
		if (!Object.values(orderKeys).includes(generatedKey)) return generatedKey;
		return resolveCollision(generatedKey, Object.values(orderKeys));
	}

	constructor(defaultSchema?: DocumentSchemaType) {
		this.schema = defaultSchema ? this.initializeSchema(defaultSchema) : this.createDefaultSchema();
	}

	private initializeSchema(defaultSchema: DocumentSchemaType): DocumentSchemaType {
		this.validateSchema(defaultSchema);
		return defaultSchema;
	}

	private createDefaultSchema(): DocumentSchemaType {
		return {
			meta: { id: '__PROJECT__', version: '2.0', title: 'Untitled' },
			config: { tileSize: 25 },
			layers: { activeLayerKey: null, data: {}, groups: {} },
			camera: { offsetX: 0, offsetY: 0, scale: 3 },
			tools: { activeTool: null, data: {} },
			history: null
		};
	}

	private validateSchema(newSchema: DocumentSchemaType): void {
		const validation = DocumentSchema.safeParse(newSchema);
		if (!validation.success) {
			console.error('Schema validation failed:', validation.error);
			throw new Error('Invalid schema');
		}
	}

	private validateLayer(layer: LayerSerializableSchemaType): void {
		const validation = LayerSerializableSchema.safeParse(layer);
		if (!validation.success) {
			console.error('Layer validation failed:', validation.error);
			throw new Error('Invalid layer schema');
		}
	}

	private updateLayerIndex(
		layer: LayerSerializableSchemaType,
		newIndex: number,
		updates: Partial<LayerSerializableSchemaType>
	): void {
		delete this.schema.layers.data[layer.id];
		const sortedLayers = Object.values(this.schema.layers.data).sort((a, b) => a.index - b.index);
		sortedLayers.splice(newIndex, 0, { ...layer, ...updates });
		this.schema.layers.data = Object.fromEntries(
			sortedLayers.map((l, idx) => [l.id, { ...l, index: idx }])
		);
	}

	private mergeLayer(
		layer: LayerSerializableSchemaType,
		updates: Partial<LayerSerializableSchemaType>
	): LayerSerializableSchemaType {
		const merged = {
			...layer,
			...updates
		};

		if (updates.opts) {
			merged.opts = { ...layer.opts, ...updates.opts };
		}

		return merged;
	}

	private reindexLayers(): void {
		const layers = Object.values(this.schema.layers.data).sort((a, b) => a.index - b.index);
		layers.forEach((layer, index) => (layer.index = index));
	}

	setSchema(newSchema: DocumentSchemaType): void {
		this.validateSchema(newSchema);
		this.schema = newSchema;
	}

	public addLayer(layer: LayerSerializableSchemaType): void {
		if (this.schema.layers.data[layer.id]) {
			throw new Error(`Layer with id ${layer.id} already exists.`);
		}

		const objects = layer.objects ?? {};
		const providedOrder = Array.isArray(layer.objectOrder) ? layer.objectOrder : [];
		const providedKeys = layer.orderKeys;

		const seen = new Set<string>();
		const normalizedOrder: string[] = [];
		for (const id of providedOrder) {
			if (seen.has(id)) continue;
			if (!objects[id]) continue;
			seen.add(id);
			normalizedOrder.push(id);
		}
		for (const id of Object.keys(objects)) {
			if (seen.has(id)) continue;
			seen.add(id);
			normalizedOrder.push(id);
		}

		const newLayer: LayerSerializableSchemaType = {
			...layer,
			objects,
			objectOrder: normalizedOrder
		};
		if (providedKeys && typeof providedKeys === 'object') newLayer.orderKeys = { ...providedKeys };
		this.normalizeObjectOrdering(newLayer);

		this.validateLayer(newLayer);
		this.schema.layers.data[layer.id] = newLayer;
		this.schema.layers.activeLayerKey = layer.id;
	}

	removeLayer(layerId: string): void {
		this.getLayerOrThrow(layerId);
		delete this.schema.layers.data[layerId];
		if (this.schema.layers.activeLayerKey === layerId) {
			this.schema.layers.activeLayerKey = null;
		}
	}

	updateLayer(layerId: string, updates: Partial<LayerSerializableSchemaType>): void {
		const layer = this.getLayerOrThrow(layerId);

		if (updates.index !== undefined && updates.index !== layer.index) {
			this.updateLayerIndex(layer, updates.index, updates);
		} else {
			const updatedLayer = this.mergeLayer(layer, updates);
			this.validateLayer(updatedLayer);
			this.schema.layers.data[layerId] = updatedLayer;
		}
		this.reindexLayers();
	}

	setActiveLayer(layerId: string | null): void {
		this.schema.layers.activeLayerKey = layerId;
	}

	private getLayerOrThrow(layerId: string): LayerSerializableSchemaType {
		const layer = this.schema.layers.data[layerId];
		if (!layer) {
			throw new Error(`Layer with id ${layerId} does not exist.`);
		}
		return layer;
	}

	public addSmartObject(
		layerId: string,
		objectId: string,
		objectType: string,
		toIndex: number,
		data: SmartObjectSerializableSchemaType,
		orderKey?: string
	): void {
		const layer = this.getLayerOrThrow(layerId);
		this.ensureLayerOrderingState(layer);

		layer.objects[objectId] = {
			...data,
			id: objectId,
			type: objectType,
			orderKey: orderKey ?? data.orderKey
		};

		const keys: Record<string, string> = layer.orderKeys ?? {};
		const keyToUse = orderKey ?? data.orderKey ?? this.generateOrderKeyForIndex(layer, toIndex);
		keys[objectId] = keyToUse;
		layer.orderKeys = keys;

		this.normalizeObjectOrdering(layer);
	}

	public removeSmartObject(layerId: string, objectId: string): void {
		const layer = this.getLayerOrThrow(layerId);
		delete layer.objects?.[objectId];
		const keys: Record<string, string> = layer.orderKeys ?? {};
		delete keys[objectId];
		layer.orderKeys = keys;
		this.normalizeObjectOrdering(layer);
	}

	public doObjectOperation(
		layerId: string,
		objectId: string,
		objectType: string,
		operation: ObjectOperation
	): void {
		const layer = this.getLayerOrThrow(layerId);
		let smartObject = layer.objects[objectId];

		if (!smartObject) {
			smartObject = {
				id: objectId,
				type: objectType,
				data: {}
			};
			layer.objects[objectId] = smartObject;
		}

		if (smartObject.type !== objectType) {
			console.warn(
				`Mismatched object types for ID ${objectId}. Expected ${objectType}, found ${smartObject.type}.`
			);
			return;
		}

		type MutableJson = Record<string, unknown> | unknown[];
		const isRecord = (v: unknown): v is Record<string, unknown> =>
			typeof v === 'object' && v !== null && !Array.isArray(v);

		const asArrayIndex = (k: string | number): number | null => {
			if (typeof k === 'number' && Number.isFinite(k)) return k;
			const parsed = Number.parseInt(String(k), 10);
			return Number.isFinite(parsed) ? parsed : null;
		};

		const applyOperation = (
			obj: MutableJson,
			path: (string | number)[],
			op: 'replace' | 'add' | 'remove',
			value?: unknown
		): void => {
			if (path.length === 0) {
				return;
			}

			let current: MutableJson = obj;
			for (let i = 0; i < path.length - 1; i++) {
				const key = path[i];
				const nextKey = path[i + 1];
				const nextIsNumeric = typeof nextKey === 'number';

				if (Array.isArray(current)) {
					const idx = asArrayIndex(key);
					if (idx === null) return;

					let child: unknown = current[idx];
					if (nextIsNumeric) {
						if (!Array.isArray(child)) child = [];
					} else {
						if (!isRecord(child)) child = {};
					}
					current[idx] = child;
					current = child as MutableJson;
				} else {
					const k = String(key);
					let child: unknown = current[k];
					if (nextIsNumeric) {
						if (!Array.isArray(child)) child = [];
					} else {
						if (!isRecord(child)) child = {};
					}
					current[k] = child;
					current = child as MutableJson;
				}
			}

			const finalKey = path[path.length - 1];

			switch (op) {
				case 'replace':
					if (Array.isArray(current)) {
						const idx = asArrayIndex(finalKey);
						if (idx === null) return;
						current[idx] = operation.value;
					} else {
						current[String(finalKey)] = operation.value;
					}
					break;
				case 'add':
					if (Array.isArray(current)) {
						const idx = asArrayIndex(finalKey);
						if (idx === null) return;
						current.splice(idx, 0, value);
					} else {
						const k = String(finalKey);
						const existing = current[k];
						if (Array.isArray(existing)) {
							(existing as unknown[]).push(value);
						} else {
							current[k] = value;
						}
					}
					break;
				case 'remove':
					if (Array.isArray(current)) {
						const idx = asArrayIndex(finalKey);
						if (idx === null) return;
						current.splice(idx, 1);
					} else {
						delete current[String(finalKey)];
					}
					break;
			}
		};

		const parsePath = (path: string): (string | number)[] => {
			const parts = path
				.replace(/\[(\d+)\]/g, '.$1')
				.split('.')
				.filter(Boolean);
			return parts;
		};

		const pathParts = parsePath(operation.path);

		const fullPath = [...pathParts];

		applyOperation(smartObject, fullPath, operation.op, operation.value);
	}

	moveSmartObject(layerId: string, objectId: string, newIndex: number, orderKey?: string): void {
		const layer = this.getLayerOrThrow(layerId);
		this.ensureLayerOrderingState(layer);
		const keys: Record<string, string> = layer.orderKeys ?? {};
		const keyToUse =
			orderKey ?? keys[objectId] ?? this.generateOrderKeyForIndex(layer, newIndex, objectId);
		keys[objectId] = keyToUse;
		layer.orderKeys = keys;
		this.normalizeObjectOrdering(layer);
	}

	getSchema(): DocumentSchemaType {
		return this.schema;
	}

	addGroup(group: LayerGroupSerializableSchemaType): void {
		if (!this.schema.layers.groups) {
			this.schema.layers.groups = {};
		}
		this.schema.layers.groups[group.id] = group;
	}

	public removeGroup(groupId: string): void {
		if (!this.schema.layers.groups) return;
		delete this.schema.layers.groups[groupId];
	}

	public updateGroup(groupId: string, updates: Partial<LayerGroupSerializableSchemaType>): void {
		if (!this.schema.layers.groups) return;
		const group = this.schema.layers.groups[groupId];
		if (!group) return;

		const merged = { ...group, ...updates };
		if (updates.opts) {
			merged.opts = { ...group.opts, ...updates.opts };
		}
		this.schema.layers.groups[groupId] = merged;
	}

	public getGroup(groupId: string): LayerGroupSerializableSchemaType | undefined {
		return this.schema.layers.groups?.[groupId];
	}
}
