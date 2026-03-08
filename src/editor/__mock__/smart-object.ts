import { StandardGroupKeys, TransformProperties } from '@editor/objects/properties';
import { BaseSmartObject } from '@editor/objects/smart-object.base';
import type { CellRectangle } from '@editor/types';
import type { Config } from '@editor/config';
import type {
	SmartObjectSerializableSchemaType,
	SerializedSmartObjectData
} from '@editor/serializer/smart-object.schema';
import { vi } from 'vitest';
import { nanoid } from 'nanoid';

export class MockSmartObject extends BaseSmartObject {
	id: string = nanoid();

	static type = '__mock__smart__object';
	readonly type = '__mock__smart__object';

	constructor(bounds: CellRectangle | unknown, id?: unknown) {
		const b = (bounds as CellRectangle) ?? { cellX: 0, cellY: 0, width: 1, height: 1 };
		super(b, {
			capabilities: { canMove: true, canResize: true, canRotate: true, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: b.cellX },
					[TransformProperties.Y]: { type: 'number', value: b.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: b.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: b.height, min: 1 },
					[TransformProperties.ROTATION]: { type: 'number', value: 0 }
				}
			}
		});
		if (typeof id === 'string') {
			this.id = id;
		}
	}

	public hitTest = vi.fn();
	public regionHitTest = vi.fn();
	public clone() {
		const cloned = new MockSmartObject({
			cellX: this.getProperty('transform.x'),
			cellY: this.getProperty('transform.y'),
			width: this.getProperty('transform.width'),
			height: this.getProperty('transform.height')
		});
		const rotation = this.getProperty('transform.rotation');
		if (typeof rotation === 'number') {
			cloned.setProperty('transform.rotation', rotation);
		}
		cloned.id = this.id;
		return cloned;
	}
	public render = vi.fn();
	public toJson() {
		return {};
	}
	static deserialize(
		_config: Config,
		_data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): MockSmartObject {
		const x = fullData?.properties?.transform?.x?.value ?? 0;
		const y = fullData?.properties?.transform?.y?.value ?? 0;
		const width = fullData?.properties?.transform?.width?.value ?? 1;
		const height = fullData?.properties?.transform?.height?.value ?? 1;
		return new MockSmartObject({ cellX: x, cellY: y, width, height });
	}
}
