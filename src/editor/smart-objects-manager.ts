import type { Config } from './config';
import type { ISmartObject, SmartObjectClass } from './objects/smart-object.interface';
import { TextGridObject } from './objects/text-grid-object';
import { TextSelectionObject } from './objects/text-selection-object';
import type { SmartObjectSerializableSchemaType } from './serializer/smart-object.schema';

export class SmartObjectsManager {
	private registry: Map<string, SmartObjectClass> = new Map();

	constructor(private config: Config) {
		this.registry.set('text-grid', TextGridObject);
		this.registry.set('text-selection', TextSelectionObject);
	}

	register(type: string, object: SmartObjectClass) {
		if (this.isAlreadyRegistered(type)) {
			throw new Error(`Object type ${type} is already registered`);
		}
		this.registry.set(type, object);
	}

	unregister(type: string) {
		this.registry.delete(type);
	}

	getObject(type: string): SmartObjectClass | undefined {
		return this.registry.get(type);
	}

	createObject(type: string, data: SmartObjectSerializableSchemaType): ISmartObject | undefined {
		const smartObjectClass = this.getObject(type);
		if (!smartObjectClass) return undefined;

		const smartObject = smartObjectClass.deserialize(this.config, data.data, data);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(smartObject as any).id = data.id;
		smartObject.properties.setFromSnapshot(data.properties);

		return smartObject;
	}

	private isAlreadyRegistered(type: string): boolean {
		return this.registry.has(type);
	}
}
