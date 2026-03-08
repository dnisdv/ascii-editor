export enum StandardGroupKeys {
	META = 'meta',
	TRANSFORM = 'transform',
	FILL_AND_STROKE = 'fill_and_stroke'
}

export enum TransformProperties {
	X = 'x',
	Y = 'y',
	WIDTH = 'width',
	HEIGHT = 'height',
	ROTATION = 'rotation'
}

export enum FillAndStrokeProperties {
	FILL_COLOR = 'fillColor',
	STROKE_COLOR = 'strokeColor',
	STROKE_WIDTH = 'strokeWidth'
}

export enum MetaProperties {
	NAME = 'name'
}

type NumberSpec = {
	type: 'number';
	value: number;
	min?: number;
	max?: number;
	step?: number;
	policy?: 'clamp' | 'reject' | 'wrap';
};
type StringSpec = { type: 'string'; value: string; pattern?: RegExp };
type BooleanSpec = { type: 'boolean'; value: boolean };
type EnumSpec<T extends string> = { type: 'enum'; value: T; values: readonly T[] };

type ValueSpec = NumberSpec | StringSpec | BooleanSpec | EnumSpec<string>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SpecToTs<T extends ValueSpec> = T['type'] extends 'number'
	? number
	: T['type'] extends 'string'
		? string
		: T['type'] extends 'boolean'
			? boolean
			: T['type'] extends 'enum'
				? T extends EnumSpec<infer U>
					? U
					: never
				: never;

type TransformPropertyValues = {
	[K in TransformProperties]: NumberSpec;
};

type FillAndStrokePropertyValues = {
	[FillAndStrokeProperties.FILL_COLOR]: StringSpec;
	[FillAndStrokeProperties.STROKE_COLOR]: StringSpec;
	[FillAndStrokeProperties.STROKE_WIDTH]: NumberSpec;
};

type MetaPropertyValues = {
	[MetaProperties.NAME]: StringSpec;
};

export type Properties = {
	[StandardGroupKeys.TRANSFORM]?: Partial<TransformPropertyValues>;
	[StandardGroupKeys.FILL_AND_STROKE]?: Partial<FillAndStrokePropertyValues>;
	[StandardGroupKeys.META]?: Partial<MetaPropertyValues>;
};
