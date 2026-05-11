import type { NumberSpec, StringSpec, BooleanSpec, EnumSpec } from '@editor/objects/properties';

export type PropertySpec =
	| Omit<NumberSpec, 'value' | 'policy'>
	| Omit<StringSpec, 'value' | 'pattern'>
	| Omit<BooleanSpec, 'value'>
	| Omit<EnumSpec, 'value'>;

export type FieldDescriptor = {
	path: string;
	groupKey: string;
	fieldKey: string;
	label: string;
	spec: PropertySpec;
	value: unknown;
	isMixed: boolean;
};

export type GroupDescriptor = {
	key: string;
	label: string;
	fields: FieldDescriptor[];
};

export type ObjectDescriptor = {
	objectId: string;
	objectType: string;
	objectName: string;
	uniqueGroups: GroupDescriptor[];
};

export type PanelDescriptor = {
	isEmpty: boolean;
	count: number;
	primaryObjectType: string | null;
	primaryObjectName: string | null;
	commonGroups: GroupDescriptor[];
	objectDescriptors: ObjectDescriptor[];
};
