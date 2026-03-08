import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';

export const getSerializedObjectSize = (object: SmartObjectSerializableSchemaType) => {
	const { x: cellX, y: cellY, width, height } = object.properties.transform;
	return { cellX: cellX.value, cellY: cellY.value, width: width.value, height: height.value };
};
