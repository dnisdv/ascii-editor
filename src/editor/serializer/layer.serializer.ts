import type { LayerSerializableSchemaType } from './layer.serializer.schema';
import { Layer } from '@editor/layers/layer';
import { SmartObjectsManager } from '@editor/smart-objects-manager';
import { Config } from '@editor/config';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { SmartObjectSerializableSchemaType } from './smart-object.schema';

export interface LayersSerializerOptions {
	smartObjectsManager: SmartObjectsManager;
	config: Config;
}

export class LayerSerializer {
	private smartObjectsManager: SmartObjectsManager;
	private config: Config;

	constructor(smartObjectsManager: SmartObjectsManager, config: Config) {
		this.smartObjectsManager = smartObjectsManager;
		this.config = config;
	}

	serialize(layer: Layer): LayerSerializableSchemaType {
		const orderKeys: Record<string, string> = {};
		const serializedObjects = layer.objects.map((obj) => {
			const key = layer.getOrderKey(obj.id);
			if (typeof key === 'string') orderKeys[obj.id] = key;
			return {
				...obj.serialize(),
				orderKey: key
			} as SmartObjectSerializableSchemaType;
		});

		const objectsMap = serializedObjects.reduce<Record<string, SmartObjectSerializableSchemaType>>(
			(accumulator, currentObject) => {
				accumulator[currentObject.id] = currentObject;
				return accumulator;
			},
			{}
		);

		return {
			id: layer.id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts,
			objects: objectsMap,
			objectOrder: layer.objects.map((obj) => obj.id),
			orderKeys
		};
	}

	deserialize(layerData: LayerSerializableSchemaType): Layer {
		const objectsMap = layerData.objects || {};
		const objectOrder = layerData.objectOrder || [];
		const layerOrderKeys = layerData.orderKeys || {};

		const orderKeys: Record<string, string> = {};
		const objects = objectOrder
			.map((id) => {
				const objData = objectsMap[id];

				if (!objData) {
					console.warn(`Object with id ${id} found in objectOrder but not in objects map.`);
					return null;
				}

				const key = layerOrderKeys[id] || objData.orderKey;
				if (typeof key === 'string' && key.length > 0) orderKeys[id] = key;

				const dataWithId = {
					...objData,
					id: id
				};

				return this.smartObjectsManager.createObject(objData.type, dataWithId);
			})
			.filter((obj): obj is ISmartObject => obj !== null);

		const newLayer = new Layer({
			id: layerData.id,
			name: layerData.name,
			index: layerData.index,
			opts: layerData.opts,
			objects,
			orderKeys,
			config: this.config
		});

		return newLayer;
	}

	public deserializeObject(data: SmartObjectSerializableSchemaType): ISmartObject {
		const dataWithId = { ...data, id: data.id };
		const obj = this.smartObjectsManager.createObject(data.type, dataWithId);
		if (!obj)
			throw new Error(`Failed to deserialize smart object type="${data.type}" id="${data.id}"`);
		return obj;
	}
}
