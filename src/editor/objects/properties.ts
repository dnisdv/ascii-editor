export enum StandardGroupKeys {
	META = 'meta',
	TRANSFORM = 'transform',
	FILL_AND_STROKE = 'fill_and_stroke',
	APPEARANCE = 'appearance'
}

export enum AppearanceProperties {
	HORIZONTAL   = 'horizontal',
	VERTICAL     = 'vertical',
	TOP_LEFT     = 'topLeft',
	TOP_RIGHT    = 'topRight',
	BOTTOM_LEFT  = 'bottomLeft',
	BOTTOM_RIGHT = 'bottomRight',
	ARROW_RIGHT  = 'arrowRight',
	ARROW_LEFT   = 'arrowLeft',
	ARROW_DOWN   = 'arrowDown',
	ARROW_UP     = 'arrowUp',
	DIAGONAL_DOWN = 'diagonalDown',
	DIAGONAL_UP   = 'diagonalUp',
	BORDER_STYLE  = 'borderStyle',
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

export type NumberSpec = {
	type: 'number';
	value: number;
	min?: number;
	max?: number;
	step?: number;
	policy?: 'clamp' | 'reject' | 'wrap';
};
export type StringSpec = { type: 'string'; value: string; pattern?: RegExp };
export type BooleanSpec = { type: 'boolean'; value: boolean };
export type EnumSpec<T extends string = string> = { type: 'enum'; value: T; values: readonly T[] };

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

type AppearancePropertyValues = {
	[AppearanceProperties.HORIZONTAL]:    StringSpec;
	[AppearanceProperties.VERTICAL]:      StringSpec;
	[AppearanceProperties.TOP_LEFT]:      StringSpec;
	[AppearanceProperties.TOP_RIGHT]:     StringSpec;
	[AppearanceProperties.BOTTOM_LEFT]:   StringSpec;
	[AppearanceProperties.BOTTOM_RIGHT]:  StringSpec;
	[AppearanceProperties.ARROW_RIGHT]:   StringSpec;
	[AppearanceProperties.ARROW_LEFT]:    StringSpec;
	[AppearanceProperties.ARROW_DOWN]:    StringSpec;
	[AppearanceProperties.ARROW_UP]:      StringSpec;
	[AppearanceProperties.DIAGONAL_DOWN]: StringSpec;
	[AppearanceProperties.DIAGONAL_UP]:   StringSpec;
	[AppearanceProperties.BORDER_STYLE]:  EnumSpec<'single' | 'double' | 'rounded' | 'ascii'>;
};

export type Properties = {
	[StandardGroupKeys.TRANSFORM]?: Partial<TransformPropertyValues>;
	[StandardGroupKeys.FILL_AND_STROKE]?: Partial<FillAndStrokePropertyValues>;
	[StandardGroupKeys.META]?: Partial<MetaPropertyValues>;
	[StandardGroupKeys.APPEARANCE]?: Partial<AppearancePropertyValues>;
};
