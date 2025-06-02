// @ts-no-check

/* eslint-disable */

import { vi } from 'vitest';

const createMockEmbindObject = <T extends string>(
	type: T,
	additionalProps: Record<string, any> = {}
) => ({
	_type: type,
	delete: vi.fn(),
	deleteLater: vi.fn(),
	isAliasOf: vi.fn().mockReturnValue(false),
	isDeleted: vi.fn().mockReturnValue(false),
	...additionalProps
});

const mockColor = (r = 0, g = 0, b = 0, a = 1) => new Float32Array([r, g, b, a]);
const mockRect = (l = 0, t = 0, r = 0, b = 0) => new Float32Array([l, t, r, b]);
const mockIRect = (l = 0, t = 0, r = 0, b = 0) => new Int32Array([l, t, r, b]);
const mockRRect = () => new Float32Array(12);
const mockPoint = (x = 0, y = 0) => new Float32Array([x, y]);
const mockMatrix3x3 = () => new Float32Array(9);
const mockMatrix4x4 = () => new Float32Array(16);
const mockColorMatrix = () => new Float32Array(20);

const mockMallocObj = () => ({
	length: 0,
	byteOffset: 0,
	subarray: vi.fn(() => new Uint8Array()),
	toTypedArray: vi.fn(() => new Uint8Array())
});

let mockPathInstance: any;
let mockPaintInstance: any;
let mockImageInstance: any;
let mockSurfaceInstance: any;
let mockCanvasInstance: any;
let mockShaderInstance: any;
let mockColorFilterInstance: any;
let mockImageFilterInstance: any;
let mockPathEffectInstance: any;
let mockMaskFilterInstance: any;
let mockTypefaceInstance: any;
let mockFontInstance: any;
let mockTextBlobInstance: any;
let mockSkottieAnimationInstance: any;
let mockManagedSkottieAnimationInstance: any;
let mockParagraphInstance: any;
let mockParagraphBuilderInstance: any;
let mockPictureRecorderInstance: any;
let mockSkPictureInstance: any;
let mockVerticesInstance: any;
let mockContourMeasureIterInstance: any;
let mockContourMeasureInstance: any;
let mockFontMgrInstance: any;
let mockTypefaceFontProviderInstance: any;
let mockFontCollectionInstance: any;
let mockRuntimeEffectInstance: any;
let mockBlenderInstance: any;
let mockGrDirectContextInstance: any;
let mockWebGPUCanvasContextInstance: any;
let mockAnimatedImageInstance: any;
let mockEmulatedCanvas2DInstance: any;
let mockDebugTraceInstance: any;

const mockEmbindEnumEntity = (value: number) => ({ value });

const AlphaTypeEnum = {
	Opaque: mockEmbindEnumEntity(0),
	Premul: mockEmbindEnumEntity(1),
	Unpremul: mockEmbindEnumEntity(2),
	values: [0, 1, 2]
};
const BlendModeEnum = {
	Clear: mockEmbindEnumEntity(0),
	Src: mockEmbindEnumEntity(1),
	Dst: mockEmbindEnumEntity(2),
	SrcOver: mockEmbindEnumEntity(3),
	Luminosity: mockEmbindEnumEntity(28),
	values: Array.from({ length: 29 }, (_, i) => i)
};
const ColorTypeEnum = {
	Alpha_8: mockEmbindEnumEntity(0),
	RGB_565: mockEmbindEnumEntity(1),
	RGBA_8888: mockEmbindEnumEntity(2),
	RGBA_F32: mockEmbindEnumEntity(8),
	values: Array.from({ length: 9 }, (_, i) => i)
};
const FillTypeEnum = {
	Winding: mockEmbindEnumEntity(0),
	EvenOdd: mockEmbindEnumEntity(1),
	values: [0, 1]
};
const FilterModeEnum = {
	Nearest: mockEmbindEnumEntity(0),
	Linear: mockEmbindEnumEntity(1),
	values: [0, 1]
};
const MipmapModeEnum = {
	None: mockEmbindEnumEntity(0),
	Nearest: mockEmbindEnumEntity(1),
	Linear: mockEmbindEnumEntity(2),
	values: [0, 1, 2]
};
const StrokeCapEnum = {
	Butt: mockEmbindEnumEntity(0),
	Round: mockEmbindEnumEntity(1),
	Square: mockEmbindEnumEntity(2),
	values: [0, 1, 2]
};
const StrokeJoinEnum = {
	Miter: mockEmbindEnumEntity(0),
	Round: mockEmbindEnumEntity(1),
	Bevel: mockEmbindEnumEntity(2),
	values: [0, 1, 2]
};
const TileModeEnum = {
	Clamp: mockEmbindEnumEntity(0),
	Repeat: mockEmbindEnumEntity(1),
	Mirror: mockEmbindEnumEntity(2),
	Decal: mockEmbindEnumEntity(3),
	values: [0, 1, 2, 3]
};
const VertexModeEnum = {
	Triangles: mockEmbindEnumEntity(0),
	TrianglesStrip: mockEmbindEnumEntity(1),
	TriangleFan: mockEmbindEnumEntity(2),
	values: [0, 1, 2]
};
const ClipOpEnum = {
	Difference: mockEmbindEnumEntity(0),
	Intersect: mockEmbindEnumEntity(1),
	values: [0, 1]
};

const mockColorSpaceObject = (name: string) => createMockEmbindObject('ColorSpace', { name });
const ColorSpaceEnumValues = {
	SRGB: mockColorSpaceObject('srgb'),
	DISPLAY_P3: mockColorSpaceObject('display-p3'),
	ADOBE_RGB: mockColorSpaceObject('adobe-rgb'),
	Equals: vi.fn((a, b) => a === b || (a && b && a.name === b.name))
};

mockPathInstance = createMockEmbindObject('Path', {
	addArc: vi.fn(function () {}),
	addCircle: vi.fn(function () {}),
	addOval: vi.fn(function () {}),
	addPath: vi.fn(function () {}),
	addPoly: vi.fn(function () {}),
	addRect: vi.fn(function () {}),
	addRRect: vi.fn(function () {}),
	addVerbsPointsWeights: vi.fn(function () {}),
	arc: vi.fn(function () {}),
	arcToOval: vi.fn(function () {}),
	arcToRotated: vi.fn(function () {}),
	arcToTangent: vi.fn(function () {}),
	close: vi.fn(function () {}),
	computeTightBounds: vi.fn(mockRect),
	conicTo: vi.fn(function () {}),
	contains: vi.fn().mockReturnValue(false),
	copy: vi.fn(function () {}),
	countPoints: vi.fn().mockReturnValue(0),
	cubicTo: vi.fn(function () {}),
	dash: vi.fn().mockReturnValue(true),
	equals: vi.fn().mockReturnValue(false),
	getBounds: vi.fn(mockRect),
	getFillType: vi.fn(() => FillTypeEnum.Winding),
	getPoint: vi.fn(mockPoint),
	isEmpty: vi.fn().mockReturnValue(true),
	isVolatile: vi.fn().mockReturnValue(false),
	lineTo: vi.fn(function () {}),
	makeAsWinding: vi.fn(function () {}),
	moveTo: vi.fn(function () {}),
	offset: vi.fn(function () {}),
	op: vi.fn().mockReturnValue(true),
	quadTo: vi.fn(function () {}),
	rArcTo: vi.fn(function () {}),
	rConicTo: vi.fn(function () {}),
	rCubicTo: vi.fn(function () {}),
	reset: vi.fn(),
	rewind: vi.fn(),
	rLineTo: vi.fn(function () {}),
	rMoveTo: vi.fn(function () {}),
	rQuadTo: vi.fn(function () {}),
	setFillType: vi.fn(),
	setIsVolatile: vi.fn(),
	simplify: vi.fn().mockReturnValue(true),
	stroke: vi.fn(function () {}),
	toCmds: vi.fn(() => new Float32Array()),
	toSVGString: vi.fn().mockReturnValue('<path d="M0,0"/>'),
	transform: vi.fn(function () {}),
	trim: vi.fn(function () {})
});

mockPaintInstance = createMockEmbindObject('Paint', {
	copy: vi.fn(function () {}),
	getColor: vi.fn(mockColor),
	getStrokeCap: vi.fn(() => StrokeCapEnum.Butt),
	getStrokeJoin: vi.fn(() => StrokeJoinEnum.Miter),
	getStrokeMiter: vi.fn().mockReturnValue(4),
	getStrokeWidth: vi.fn().mockReturnValue(1),
	setAlphaf: vi.fn(),
	setAntiAlias: vi.fn(),
	setBlendMode: vi.fn(),
	setBlender: vi.fn(),
	setColor: vi.fn(),
	setColorComponents: vi.fn(),
	setColorFilter: vi.fn(),
	setColorInt: vi.fn(),
	setDither: vi.fn(),
	setImageFilter: vi.fn(),
	setMaskFilter: vi.fn(),
	setPathEffect: vi.fn(),
	setShader: vi.fn(),
	setStrokeCap: vi.fn(),
	setStrokeJoin: vi.fn(),
	setStrokeMiter: vi.fn(),
	setStrokeWidth: vi.fn(),
	setStyle: vi.fn()
});

mockImageInstance = createMockEmbindObject('Image', {
	encodeToBytes: vi.fn(() => new Uint8Array()),
	getColorSpace: vi.fn(() => ColorSpaceEnumValues.SRGB),
	getImageInfo: vi.fn(() => ({
		alphaType: AlphaTypeEnum.Premul,
		colorType: ColorTypeEnum.RGBA_8888,
		height: 100,
		width: 100
	})),
	height: vi.fn().mockReturnValue(100),
	makeCopyWithDefaultMipmaps: vi.fn(function () {}),
	makeShaderCubic: vi.fn(() => mockShaderInstance),
	makeShaderOptions: vi.fn(() => mockShaderInstance),
	readPixels: vi.fn(() => new Uint8Array()),
	width: vi.fn().mockReturnValue(100)
});

mockCanvasInstance = createMockEmbindObject('Canvas', {
	clear: vi.fn(),
	clipPath: vi.fn(),
	clipRect: vi.fn(),
	clipRRect: vi.fn(),
	concat: vi.fn(),
	drawArc: vi.fn(),
	drawAtlas: vi.fn(),
	drawCircle: vi.fn(),
	drawColor: vi.fn(),
	drawColorComponents: vi.fn(),
	drawColorInt: vi.fn(),
	drawDRRect: vi.fn(),
	drawGlyphs: vi.fn(),
	drawImage: vi.fn(),
	drawImageCubic: vi.fn(),
	drawImageOptions: vi.fn(),
	drawImageNine: vi.fn(),
	drawImageRect: vi.fn(),
	drawImageRectCubic: vi.fn(),
	drawImageRectOptions: vi.fn(),
	drawLine: vi.fn(),
	drawOval: vi.fn(),
	drawPaint: vi.fn(),
	drawParagraph: vi.fn(),
	drawPath: vi.fn(),
	drawPatch: vi.fn(),
	drawPicture: vi.fn(),
	drawPoints: vi.fn(),
	drawRect: vi.fn(),
	drawRect4f: vi.fn(),
	drawRRect: vi.fn(),
	drawShadow: vi.fn(),
	drawText: vi.fn(),
	drawTextBlob: vi.fn(),
	drawVertices: vi.fn(),
	getDeviceClipBounds: vi.fn(mockIRect),
	getLocalToDevice: vi.fn(mockMatrix4x4),
	getSaveCount: vi.fn().mockReturnValue(1),
	getTotalMatrix: vi.fn(mockMatrix3x3),
	makeSurface: vi.fn(() => mockSurfaceInstance),
	readPixels: vi.fn(() => new Uint8Array()),
	restore: vi.fn(),
	restoreToCount: vi.fn(),
	rotate: vi.fn(),
	save: vi.fn().mockReturnValue(1),
	saveLayer: vi.fn().mockReturnValue(1),
	scale: vi.fn(),
	skew: vi.fn(),
	translate: vi.fn(),
	writePixels: vi.fn().mockReturnValue(true)
});

mockSurfaceInstance = createMockEmbindObject('Surface', {
	drawOnce: vi.fn((cb) => {
		if (cb) cb(mockCanvasInstance);
	}),
	dispose: vi.fn(),
	flush: vi.fn(),
	getCanvas: vi.fn(() => mockCanvasInstance),
	height: vi.fn().mockReturnValue(300),
	imageInfo: vi.fn(() => ({
		alphaType: AlphaTypeEnum.Premul,
		colorSpace: ColorSpaceEnumValues.SRGB,
		colorType: ColorTypeEnum.RGBA_8888,
		height: 300,
		width: 400
	})),
	makeImageFromTexture: vi.fn(() => mockImageInstance),
	makeImageFromTextureSource: vi.fn(() => mockImageInstance),
	makeImageSnapshot: vi.fn(() => mockImageInstance),
	makeSurface: vi.fn(function () {}),
	reportBackendTypeIsGPU: vi.fn().mockReturnValue(false),
	requestAnimationFrame: vi.fn((cb) => {
		if (cb) cb(mockCanvasInstance);
		return 0;
	}),
	sampleCnt: vi.fn().mockReturnValue(0),
	updateTextureFromSource: vi.fn(),
	width: vi.fn().mockReturnValue(400)
});

mockShaderInstance = createMockEmbindObject('Shader');
mockColorFilterInstance = createMockEmbindObject('ColorFilter');
mockImageFilterInstance = createMockEmbindObject('ImageFilter', {
	getOutputBounds: vi.fn(mockIRect)
});
mockPathEffectInstance = createMockEmbindObject('PathEffect');
mockMaskFilterInstance = createMockEmbindObject('MaskFilter');
mockTypefaceInstance = createMockEmbindObject('Typeface', {
	getGlyphIDs: vi.fn(() => new Uint16Array())
});
mockFontInstance = createMockEmbindObject('Font', {
	getMetrics: vi.fn(() => ({ ascent: -10, descent: 3, leading: 1, bounds: mockRect() })),
	getGlyphBounds: vi.fn(() => new Float32Array()),
	getGlyphIDs: vi.fn(() => new Uint16Array()),
	getGlyphWidths: vi.fn(() => new Float32Array()),
	getGlyphIntercepts: vi.fn(() => new Float32Array()),
	getScaleX: vi.fn(() => 1),
	getSize: vi.fn(() => 12),
	getSkewX: vi.fn(() => 0),
	isEmbolden: vi.fn(() => false),
	getTypeface: vi.fn(() => mockTypefaceInstance),
	setEdging: vi.fn(),
	setEmbeddedBitmaps: vi.fn(),
	setHinting: vi.fn(),
	setLinearMetrics: vi.fn(),
	setScaleX: vi.fn(),
	setSize: vi.fn(),
	setSkewX: vi.fn(),
	setEmbolden: vi.fn(),
	setSubpixel: vi.fn(),
	setTypeface: vi.fn()
});
mockTextBlobInstance = createMockEmbindObject('TextBlob');
mockSkottieAnimationInstance = createMockEmbindObject('SkottieAnimation', {
	duration: vi.fn(() => 1),
	fps: vi.fn(() => 30),
	render: vi.fn(),
	seek: vi.fn(mockRect),
	seekFrame: vi.fn(mockRect),
	size: vi.fn(mockPoint),
	version: vi.fn(() => '1.0.0')
});
mockManagedSkottieAnimationInstance = {
	...mockSkottieAnimationInstance,
	...createMockEmbindObject('SkottieAnimation'),
	setColor: vi.fn().mockReturnValue(true),
	setOpacity: vi.fn().mockReturnValue(true),
	setText: vi.fn().mockReturnValue(true),
	setTransform: vi.fn().mockReturnValue(true),
	getMarkers: vi.fn(() => []),
	getColorProps: vi.fn(() => []),
	getOpacityProps: vi.fn(() => []),
	getTextProps: vi.fn(() => []),
	getTransformProps: vi.fn(() => []),
	getSlotInfo: vi.fn(() => ({
		colorSlotIDs: [],
		scalarSlotIDs: [],
		vec2SlotIDs: [],
		imageSlotIDs: [],
		textSlotIDs: []
	})),
	setColorSlot: vi.fn().mockReturnValue(true),
	setScalarSlot: vi.fn().mockReturnValue(true),
	setVec2Slot: vi.fn().mockReturnValue(true),
	setTextSlot: vi.fn().mockReturnValue(true),
	setImageSlot: vi.fn().mockReturnValue(true),
	getColorSlot: vi.fn(mockColor),
	getScalarSlot: vi.fn(() => 0),
	getVec2Slot: vi.fn(mockPoint),
	getTextSlot: vi.fn(() => ({})),
	attachEditor: vi.fn().mockReturnValue(true),
	enableEditor: vi.fn(),
	dispatchEditorKey: vi.fn().mockReturnValue(true),
	dispatchEditorPointer: vi.fn().mockReturnValue(true)
};
mockGrDirectContextInstance = createMockEmbindObject('GrDirectContext', {
	getResourceCacheLimitBytes: vi.fn(() => 0),
	getResourceCacheUsageBytes: vi.fn(() => 0),
	releaseResourcesAndAbandonContext: vi.fn(),
	setResourceCacheLimitBytes: vi.fn()
});
mockWebGPUCanvasContextInstance = {
	requestAnimationFrame: vi.fn((cb) => {
		if (cb) cb(mockCanvasInstance);
	})
};
mockAnimatedImageInstance = createMockEmbindObject('AnimatedImage', {
	currentFrameDuration: vi.fn(() => 33),
	decodeNextFrame: vi.fn(() => 33),
	getFrameCount: vi.fn(() => 1),
	getRepetitionCount: vi.fn(() => 0),
	height: vi.fn(() => 100),
	makeImageAtCurrentFrame: vi.fn(() => mockImageInstance),
	reset: vi.fn(),
	width: vi.fn(() => 100)
});
mockEmulatedCanvas2DInstance = {
	dispose: vi.fn(),
	decodeImage: vi.fn(() => mockImageInstance),
	getContext: vi.fn(() => ({}) as CanvasRenderingContext2D),
	loadFont: vi.fn(),
	makePath2D: vi.fn(() => ({}) as Path2D),
	toDataURL: vi.fn(() => 'data:image/png;base64,mock')
};
mockDebugTraceInstance = createMockEmbindObject('DebugTrace', {
	writeTrace: vi.fn(() => 'trace_output')
});
mockPictureRecorderInstance = createMockEmbindObject('PictureRecorder', {
	beginRecording: vi.fn(() => mockCanvasInstance),
	finishRecordingAsPicture: vi.fn(() => mockSkPictureInstance)
});
mockSkPictureInstance = createMockEmbindObject('SkPicture', {
	makeShader: vi.fn(() => mockShaderInstance),
	cullRect: vi.fn(mockRect),
	approximateBytesUsed: vi.fn(() => 0),
	serialize: vi.fn(() => new Uint8Array())
});
mockParagraphBuilderInstance = createMockEmbindObject('ParagraphBuilder', {
	addPlaceholder: vi.fn(),
	addText: vi.fn(),
	build: vi.fn(() => mockParagraphInstance),
	setWordsUtf8: vi.fn(),
	setWordsUtf16: vi.fn(),
	setGraphemeBreaksUtf8: vi.fn(),
	setGraphemeBreaksUtf16: vi.fn(),
	setLineBreaksUtf8: vi.fn(),
	setLineBreaksUtf16: vi.fn(),
	getText: vi.fn(() => ''),
	pop: vi.fn(),
	pushStyle: vi.fn(),
	pushPaintStyle: vi.fn(),
	reset: vi.fn()
});
mockParagraphInstance = createMockEmbindObject('Paragraph', {
	getMinIntrinsicWidth: vi.fn(() => false),
	getHeight: vi.fn(() => false),
	layout: vi.fn(() => false)
});
mockContourMeasureIterInstance = createMockEmbindObject('ContourMeasureIter', {
	next: vi.fn(() => mockContourMeasureInstance)
});
mockContourMeasureInstance = createMockEmbindObject('ContourMeasure', {
	getPosTan: vi.fn(() => new Float32Array(4)),
	getSegment: vi.fn(() => mockPathInstance),
	isClosed: vi.fn(() => false),
	length: vi.fn(() => 0)
});
mockFontMgrInstance = createMockEmbindObject('FontMgr', {
	countFamilies: vi.fn(() => 0),
	getFamilyName: vi.fn(() => ''),
	matchFamilyStyle: vi.fn(() => mockTypefaceInstance)
});
mockTypefaceFontProviderInstance = {
	...mockFontMgrInstance,
	...createMockEmbindObject('FontMgr'),
	registerFont: vi.fn()
};
mockFontCollectionInstance = createMockEmbindObject('FontCollection', {
	enableFontFallback: vi.fn(),
	setDefaultFontManager: vi.fn()
});
mockRuntimeEffectInstance = createMockEmbindObject('RuntimeEffect', {
	makeBlender: vi.fn(() => mockBlenderInstance),
	makeShader: vi.fn(() => mockShaderInstance),
	makeShaderWithChildren: vi.fn(() => mockShaderInstance),
	getUniform: vi.fn(() => ({ columns: 1, rows: 1, slot: 0, isInteger: false })),
	getUniformCount: vi.fn(() => 0),
	getUniformFloatCount: vi.fn(() => 0),
	getUniformName: vi.fn(() => '')
});
mockBlenderInstance = createMockEmbindObject('Blender');
mockVerticesInstance = createMockEmbindObject('Vertices', {
	bounds: vi.fn(mockRect),
	uniqueID: vi.fn(() => 0)
});

const mockCanvasKitObject = {
	Color: vi.fn(mockColor),
	Color4f: vi.fn(mockColor),
	ColorAsInt: vi.fn().mockReturnValue(0xff000000),
	getColorComponents: vi.fn().mockReturnValue([0, 0, 0, 1]),
	parseColorString: vi.fn(mockColor),
	multiplyByAlpha: vi.fn(mockColor),
	computeTonalColors: vi.fn(() => ({ ambient: mockColor(), spot: mockColor() })),
	LTRBRect: vi.fn(mockRect),
	XYWHRect: vi.fn(mockRect),
	LTRBiRect: vi.fn(mockIRect),
	XYWHiRect: vi.fn(mockIRect),
	RRectXY: vi.fn(mockRRect),
	getShadowLocalBounds: vi.fn(mockRect),
	Malloc: vi.fn(mockMallocObj),
	MallocGlyphIDs: vi.fn(mockMallocObj),
	Free: vi.fn(),

	MakeCanvasSurface: vi.fn(() => mockSurfaceInstance),
	MakeRasterDirectSurface: vi.fn(() => mockSurfaceInstance),
	MakeSWCanvasSurface: vi.fn(() => mockSurfaceInstance),
	MakeWebGLCanvasSurface: vi.fn(() => mockSurfaceInstance),
	MakeSurface: vi.fn(() => mockSurfaceInstance),
	GetWebGLContext: vi.fn().mockReturnValue(1),
	MakeGrContext: vi.fn(() => mockGrDirectContextInstance),
	MakeWebGLContext: vi.fn(() => mockGrDirectContextInstance),
	MakeOnScreenGLSurface: vi.fn(() => mockSurfaceInstance),
	MakeGPUDeviceContext: vi.fn(() => mockGrDirectContextInstance),
	MakeGPUTextureSurface: vi.fn(() => mockSurfaceInstance),
	MakeGPUCanvasContext: vi.fn(() => mockWebGPUCanvasContextInstance),
	MakeGPUCanvasSurface: vi.fn(() => mockSurfaceInstance),
	MakeRenderTarget: vi.fn(() => mockSurfaceInstance),
	MakeLazyImageFromTextureSource: vi.fn(() => mockImageInstance),
	deleteContext: vi.fn(),
	getDecodeCacheLimitBytes: vi.fn().mockReturnValue(0),
	getDecodeCacheUsedBytes: vi.fn().mockReturnValue(0),
	setDecodeCacheLimitBytes: vi.fn(),
	MakeAnimatedImageFromEncoded: vi.fn(() => mockAnimatedImageInstance),
	MakeCanvas: vi.fn(() => mockEmulatedCanvas2DInstance),
	MakeImage: vi.fn(() => mockImageInstance),
	MakeImageFromEncoded: vi.fn(() => mockImageInstance),
	MakeImageFromCanvasImageSource: vi.fn(() => mockImageInstance),
	MakePicture: vi.fn(() => mockSkPictureInstance),
	MakeVertices: vi.fn(() => mockVerticesInstance),
	MakeAnimation: vi.fn(() => mockSkottieAnimationInstance),
	MakeManagedAnimation: vi.fn(() => mockManagedSkottieAnimationInstance),

	ImageData: vi.fn(),
	ParagraphStyle: vi.fn((ps) => ps),
	ContourMeasureIter: vi.fn(() => mockContourMeasureIterInstance),
	Font: vi.fn(() => mockFontInstance),
	Paint: vi.fn(() => mockPaintInstance),
	Path: vi.fn(() => {}),
	PictureRecorder: vi.fn(() => mockPictureRecorderInstance),
	TextStyle: vi.fn((ts) => ts),
	SlottableTextProperty: vi.fn((stp) => stp),

	ParagraphBuilder: {
		Make: vi.fn(() => mockParagraphBuilderInstance),
		MakeFromFontProvider: vi.fn(() => mockParagraphBuilderInstance),
		MakeFromFontCollection: vi.fn(() => mockParagraphBuilderInstance),
		ShapeText: vi.fn().mockReturnValue([]),
		RequiresClientICU: vi.fn().mockReturnValue(false)
	},
	Blender: { Mode: vi.fn(() => mockBlenderInstance) },
	ColorFilter: {
		MakeBlend: vi.fn(() => mockColorFilterInstance),
		MakeCompose: vi.fn(() => mockColorFilterInstance),
		MakeLerp: vi.fn(() => mockColorFilterInstance),
		MakeLinearToSRGBGamma: vi.fn(() => mockColorFilterInstance),
		MakeMatrix: vi.fn(() => mockColorFilterInstance),
		MakeSRGBToLinearGamma: vi.fn(() => mockColorFilterInstance),
		MakeLuma: vi.fn(() => mockColorFilterInstance)
	},
	FontCollection: { Make: vi.fn(() => mockFontCollectionInstance) },
	FontMgr: { FromData: vi.fn(() => mockFontMgrInstance) },
	ImageFilter: {
		MakeBlend: vi.fn(() => mockImageFilterInstance),
		MakeBlur: vi.fn(() => mockImageFilterInstance),
		MakeColorFilter: vi.fn(() => mockImageFilterInstance),
		MakeCompose: vi.fn(() => mockImageFilterInstance),
		MakeDilate: vi.fn(() => mockImageFilterInstance),
		MakeDisplacementMap: vi.fn(() => mockImageFilterInstance),
		MakeDropShadow: vi.fn(() => mockImageFilterInstance),
		MakeDropShadowOnly: vi.fn(() => mockImageFilterInstance),
		MakeErode: vi.fn(() => mockImageFilterInstance),
		MakeImage: vi.fn(() => mockImageFilterInstance),
		MakeMatrixTransform: vi.fn(() => mockImageFilterInstance),
		MakeOffset: vi.fn(() => mockImageFilterInstance),
		MakeShader: vi.fn(() => mockImageFilterInstance)
	},
	MaskFilter: { MakeBlur: vi.fn(() => mockMaskFilterInstance) },
	PathEffect: {
		MakeCorner: vi.fn(() => mockPathEffectInstance),
		MakeDash: vi.fn(() => mockPathEffectInstance),
		MakeDiscrete: vi.fn(() => mockPathEffectInstance),
		MakeLine2D: vi.fn(() => mockPathEffectInstance),
		MakePath1D: vi.fn(() => mockPathEffectInstance),
		MakePath2D: vi.fn(() => mockPathEffectInstance)
	},
	RuntimeEffect: {
		Make: vi.fn(() => mockRuntimeEffectInstance),
		MakeForBlender: vi.fn(() => mockRuntimeEffectInstance),
		MakeTraced: vi.fn(() => ({ shader: mockShaderInstance, debugTrace: mockDebugTraceInstance }))
	},
	Shader: {
		MakeBlend: vi.fn(() => mockShaderInstance),
		MakeColor: vi.fn(() => mockShaderInstance),
		MakeFractalNoise: vi.fn(() => mockShaderInstance),
		MakeLinearGradient: vi.fn(() => mockShaderInstance),
		MakeRadialGradient: vi.fn(() => mockShaderInstance),
		MakeSweepGradient: vi.fn(() => mockShaderInstance),
		MakeTurbulence: vi.fn(() => mockShaderInstance),
		MakeTwoPointConicalGradient: vi.fn(() => mockShaderInstance)
	},
	TextBlob: {
		MakeFromGlyphs: vi.fn(() => mockTextBlobInstance),
		MakeFromRSXform: vi.fn(() => mockTextBlobInstance),
		MakeFromRSXformGlyphs: vi.fn(() => mockTextBlobInstance),
		MakeFromText: vi.fn(() => mockTextBlobInstance),
		MakeOnPath: vi.fn(() => mockTextBlobInstance)
	},
	Typeface: { MakeFreeTypeFaceFromData: vi.fn(() => mockTypefaceInstance) },
	TypefaceFontProvider: { Make: vi.fn(() => mockTypefaceFontProviderInstance) },

	ColorMatrix: {
		concat: vi.fn(mockColorMatrix),
		identity: vi.fn(mockColorMatrix),
		postTranslate: vi.fn(mockColorMatrix),
		rotated: vi.fn(mockColorMatrix),
		scaled: vi.fn(mockColorMatrix)
	},
	Matrix: {
		identity: vi.fn(mockMatrix3x3),
		invert: vi.fn(mockMatrix3x3),
		mapPoints: vi.fn(),
		multiply: vi.fn(mockMatrix3x3),
		rotated: vi.fn(mockMatrix3x3),
		scaled: vi.fn(mockMatrix3x3),
		skewed: vi.fn(mockMatrix3x3),
		translated: vi.fn(mockMatrix3x3)
	},
	M44: {
		identity: vi.fn(mockMatrix4x4),
		invert: vi.fn(mockMatrix4x4),
		lookat: vi.fn(mockMatrix4x4),
		multiply: vi.fn(mockMatrix4x4),
		mustInvert: vi.fn(mockMatrix4x4),
		perspective: vi.fn(mockMatrix4x4),
		rc: vi.fn().mockReturnValue(0),
		rotated: vi.fn(mockMatrix4x4),
		rotatedUnitSinCos: vi.fn(mockMatrix4x4),
		scaled: vi.fn(mockMatrix4x4),
		setupCamera: vi.fn(mockMatrix4x4),
		translated: vi.fn(mockMatrix4x4),
		transpose: vi.fn(mockMatrix4x4)
	},
	Vector: {
		add: vi.fn(),
		cross: vi.fn(() => [0, 0, 0]),
		dist: vi.fn().mockReturnValue(0),
		dot: vi.fn().mockReturnValue(0),
		length: vi.fn().mockReturnValue(0),
		lengthSquared: vi.fn().mockReturnValue(0),
		mulScalar: vi.fn((v) => v),
		normalize: vi.fn((v) => v),
		sub: vi.fn()
	},

	AlphaType: AlphaTypeEnum,
	BlendMode: BlendModeEnum,
	BlurStyle: {
		Normal: mockEmbindEnumEntity(0),
		Solid: mockEmbindEnumEntity(1),
		Outer: mockEmbindEnumEntity(2),
		Inner: mockEmbindEnumEntity(3),
		values: [0, 1, 2, 3]
	},
	ClipOp: ClipOpEnum,
	ColorChannel: {
		Red: mockEmbindEnumEntity(0),
		Green: mockEmbindEnumEntity(1),
		Blue: mockEmbindEnumEntity(2),
		Alpha: mockEmbindEnumEntity(3),
		values: [0, 1, 2, 3]
	},
	ColorType: ColorTypeEnum,
	FillType: FillTypeEnum,
	FilterMode: FilterModeEnum,
	FontEdging: {
		Alias: mockEmbindEnumEntity(0),
		AntiAlias: mockEmbindEnumEntity(1),
		SubpixelAntiAlias: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	FontHinting: {
		None: mockEmbindEnumEntity(0),
		Slight: mockEmbindEnumEntity(1),
		Normal: mockEmbindEnumEntity(2),
		Full: mockEmbindEnumEntity(3),
		values: [0, 1, 2, 3]
	},
	GlyphRunFlags: { IsWhiteSpace: 1 },
	ImageFormat: {
		PNG: mockEmbindEnumEntity(0),
		JPEG: mockEmbindEnumEntity(1),
		WEBP: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	MipmapMode: MipmapModeEnum,
	PaintStyle: { Fill: mockEmbindEnumEntity(0), Stroke: mockEmbindEnumEntity(1), values: [0, 1] },
	Path1DEffect: {
		Translate: mockEmbindEnumEntity(0),
		Rotate: mockEmbindEnumEntity(1),
		Morph: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	PathOp: {
		Difference: mockEmbindEnumEntity(0),
		Intersect: mockEmbindEnumEntity(1),
		Union: mockEmbindEnumEntity(2),
		XOR: mockEmbindEnumEntity(3),
		ReverseDifference: mockEmbindEnumEntity(4),
		values: [0, 1, 2, 3, 4]
	},
	PointMode: {
		Points: mockEmbindEnumEntity(0),
		Lines: mockEmbindEnumEntity(1),
		Polygon: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	ColorSpace: ColorSpaceEnumValues,
	StrokeCap: StrokeCapEnum,
	StrokeJoin: StrokeJoinEnum,
	TileMode: TileModeEnum,
	VertexMode: VertexModeEnum,
	InputState: {
		Down: mockEmbindEnumEntity(0),
		Up: mockEmbindEnumEntity(1),
		Move: mockEmbindEnumEntity(2),
		Right: mockEmbindEnumEntity(3),
		Left: mockEmbindEnumEntity(4),
		values: [0, 1, 2, 3, 4]
	},
	ModifierKey: {
		None: mockEmbindEnumEntity(0),
		Shift: mockEmbindEnumEntity(1),
		Control: mockEmbindEnumEntity(2),
		Option: mockEmbindEnumEntity(4),
		Command: mockEmbindEnumEntity(8),
		FirstPress: mockEmbindEnumEntity(16),
		values: [0, 1, 2, 4, 8, 16]
	},

	TRANSPARENT: mockColor(0, 0, 0, 0),
	BLACK: mockColor(0, 0, 0, 1),
	WHITE: mockColor(1, 1, 1, 1),
	RED: mockColor(1, 0, 0, 1),
	GREEN: mockColor(0, 1, 0, 1),
	BLUE: mockColor(0, 0, 1, 1),
	YELLOW: mockColor(1, 1, 0, 1),
	CYAN: mockColor(0, 1, 1, 1),
	MAGENTA: mockColor(1, 0, 1, 1),

	MOVE_VERB: 0,
	LINE_VERB: 1,
	QUAD_VERB: 2,
	CONIC_VERB: 3,
	CUBIC_VERB: 4,
	CLOSE_VERB: 5,
	SaveLayerInitWithPrevious: 1,
	SaveLayerF16ColorType: 2,
	ShadowTransparentOccluder: 1,
	ShadowGeometricOnly: 2,
	ShadowDirectionalLight: 4,

	gpu: true,
	managed_skottie: true,
	rt_effect: true,
	skottie: true,

	Affinity: {
		Upstream: mockEmbindEnumEntity(0),
		Downstream: mockEmbindEnumEntity(1),
		values: [0, 1]
	},
	DecorationStyle: {
		Solid: mockEmbindEnumEntity(0),
		Double: mockEmbindEnumEntity(1),
		Dotted: mockEmbindEnumEntity(2),
		Dashed: mockEmbindEnumEntity(3),
		Wavy: mockEmbindEnumEntity(4),
		values: [0, 1, 2, 3, 4]
	},
	FontSlant: {
		Upright: mockEmbindEnumEntity(0),
		Italic: mockEmbindEnumEntity(1),
		Oblique: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	FontWeight: {
		Invisible: mockEmbindEnumEntity(0),
		Thin: mockEmbindEnumEntity(100),
		ExtraLight: mockEmbindEnumEntity(200),
		Light: mockEmbindEnumEntity(300),
		Normal: mockEmbindEnumEntity(400),
		Medium: mockEmbindEnumEntity(500),
		SemiBold: mockEmbindEnumEntity(600),
		Bold: mockEmbindEnumEntity(700),
		ExtraBold: mockEmbindEnumEntity(800),
		Black: mockEmbindEnumEntity(900),
		ExtraBlack: mockEmbindEnumEntity(1000),
		values: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
	},
	FontWidth: {
		UltraCondensed: mockEmbindEnumEntity(0),
		Normal: mockEmbindEnumEntity(4),
		UltraExpanded: mockEmbindEnumEntity(8),
		values: Array.from({ length: 9 }, (_, i) => i)
	},
	PlaceholderAlignment: {
		Baseline: mockEmbindEnumEntity(0),
		Middle: mockEmbindEnumEntity(5),
		values: Array.from({ length: 6 }, (_, i) => i)
	},
	RectHeightStyle: {
		Tight: mockEmbindEnumEntity(0),
		Strut: mockEmbindEnumEntity(5),
		values: Array.from({ length: 6 }, (_, i) => i)
	},
	RectWidthStyle: { Tight: mockEmbindEnumEntity(0), Max: mockEmbindEnumEntity(1), values: [0, 1] },
	TextAlign: {
		Left: mockEmbindEnumEntity(0),
		Right: mockEmbindEnumEntity(1),
		Center: mockEmbindEnumEntity(2),
		Justify: mockEmbindEnumEntity(3),
		Start: mockEmbindEnumEntity(4),
		End: mockEmbindEnumEntity(5),
		values: [0, 1, 2, 3, 4, 5]
	},
	TextBaseline: {
		Alphabetic: mockEmbindEnumEntity(0),
		Ideographic: mockEmbindEnumEntity(1),
		values: [0, 1]
	},
	TextDirection: { RTL: mockEmbindEnumEntity(0), LTR: mockEmbindEnumEntity(1), values: [0, 1] },
	TextHeightBehavior: {
		All: mockEmbindEnumEntity(0),
		DisableFirstAscent: mockEmbindEnumEntity(1),
		DisableLastDescent: mockEmbindEnumEntity(2),
		DisableAll: mockEmbindEnumEntity(3),
		values: [0, 1, 2, 3]
	},
	VerticalTextAlign: {
		Top: mockEmbindEnumEntity(0),
		VisualBottom: mockEmbindEnumEntity(5),
		values: Array.from({ length: 6 }, (_, i) => i)
	},
	ResizePolicy: {
		None: mockEmbindEnumEntity(0),
		ScaleToFit: mockEmbindEnumEntity(1),
		DownscaleToFit: mockEmbindEnumEntity(2),
		values: [0, 1, 2]
	},
	NoDecoration: 0,
	UnderlineDecoration: 1,
	OverlineDecoration: 2,
	LineThroughDecoration: 4
};

const CanvasKitInitMock = vi.fn((opts?: any): Promise<typeof mockCanvasKitObject> => {
	if (opts && typeof opts.locateFile === 'function') {
		opts.locateFile('canvaskit.wasm');
	}
	return Promise.resolve(mockCanvasKitObject);
});

export default CanvasKitInitMock;

export {
	mockCanvasKitObject as CanvasKit,
	mockPathInstance,
	mockPaintInstance,
	mockImageInstance,
	mockSurfaceInstance,
	mockCanvasInstance
};
