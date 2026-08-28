import { BaseSmartObject } from '@editor/objects/smart-object.base';
import { ImageProperties, StandardGroupKeys, TransformProperties } from '@editor/objects/properties';
import { createPaint } from '@editor/utils/rendering';
import {
	ASCII_CHARSETS,
	ASCII_MODES,
	DEFAULT_ASCII_PARAMS,
	imageToAscii,
	type AsciiCharset,
	type AsciiMode,
	type AsciiParams,
	type ImageSource
} from './image-to-ascii';
import { decodeDataUrl } from './image-source';

import type { CellRectangle } from '@editor/types';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { Config } from '@editor/config';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';

export type ImageAsciiObjectData = {
	dataUrl?: string;
	ascii?: string;
};

export class ImageAsciiObject extends BaseSmartObject {
	static readonly type = 'image-ascii';
	readonly type = 'image-ascii';

	private _source: ImageSource | null = null;
	private _dataUrl: string | null = null;
	private _ascii: string = '';
	private _cacheKey: string | null = null;

	constructor(bounds: CellRectangle | unknown) {
		const b = (bounds as CellRectangle) ?? { cellX: 0, cellY: 0, width: 1, height: 1 };
		super(b, {
			capabilities: { canMove: true, canResize: true, canRotate: false, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: b.cellX },
					[TransformProperties.Y]: { type: 'number', value: b.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: b.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: b.height, min: 1 }
				},
				[StandardGroupKeys.IMAGE]: {
					[ImageProperties.MODE]: {
						type: 'enum',
						value: DEFAULT_ASCII_PARAMS.mode,
						values: ASCII_MODES
					},
					[ImageProperties.CHARSET]: {
						type: 'enum',
						value: DEFAULT_ASCII_PARAMS.charset,
						values: ASCII_CHARSETS
					},
					[ImageProperties.RAMP]: { type: 'string', value: DEFAULT_ASCII_PARAMS.customRamp },
					[ImageProperties.INVERT]: { type: 'boolean', value: DEFAULT_ASCII_PARAMS.invert },
					[ImageProperties.CONTRAST]: {
						type: 'number',
						value: DEFAULT_ASCII_PARAMS.contrast,
						min: -100,
						max: 100,
						step: 1,
						policy: 'clamp'
					},
					[ImageProperties.BRIGHTNESS]: {
						type: 'number',
						value: DEFAULT_ASCII_PARAMS.brightness,
						min: -100,
						max: 100,
						step: 1,
						policy: 'clamp'
					},
					[ImageProperties.THRESHOLD]: {
						type: 'number',
						value: DEFAULT_ASCII_PARAMS.threshold,
						min: 0,
						max: 100,
						step: 1,
						policy: 'clamp'
					},
					[ImageProperties.EDGE_THRESHOLD]: {
						type: 'number',
						value: DEFAULT_ASCII_PARAMS.edgeThreshold,
						min: 0,
						max: 100,
						step: 1,
						policy: 'clamp'
					}
				}
			}
		});
		this.setName('Image');
	}

	public setSource(source: ImageSource, dataUrl: string): void {
		this._source = source;
		this._dataUrl = dataUrl;
		this._cacheKey = null;
		this._updateAscii();
		this.emit('update');
	}

	public hasSource(): boolean {
		return this._source !== null;
	}

	public getDataUrl(): string | null {
		return this._dataUrl;
	}

	public getSourceAspect(): number {
		if (!this._source || this._source.width === 0) return 1;
		return this._source.height / this._source.width;
	}

	public getParams(): AsciiParams {
		return {
			mode: this.getProperty<AsciiMode>('image.mode') ?? DEFAULT_ASCII_PARAMS.mode,
			charset: this.getProperty<AsciiCharset>('image.charset') ?? DEFAULT_ASCII_PARAMS.charset,
			customRamp: this.getProperty<string>('image.ramp') ?? DEFAULT_ASCII_PARAMS.customRamp,
			invert: Boolean(this.getProperty<boolean>('image.invert')),
			contrast: Number(this.getProperty<number>('image.contrast')) || 0,
			brightness: Number(this.getProperty<number>('image.brightness')) || 0,
			threshold: Number(this.getProperty<number>('image.threshold')),
			edgeThreshold: Number(this.getProperty<number>('image.edgeThreshold'))
		};
	}

	public toAsciiString(): string {
		this._updateAscii();
		return this._ascii;
	}

	public toString(): string {
		return this.toAsciiString();
	}

	private _updateAscii(): void {
		const width = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const height = Math.max(1, Math.round(this.getProperty<number>('transform.height')));

		if (!this._source) return;

		const params = this.getParams();
		const key = `${width}x${height}|${JSON.stringify(params)}`;
		if (key === this._cacheKey) return;

		this._ascii = imageToAscii(this._source, width, height, params);
		this._cacheKey = key;
	}

	public hitTest(cellX: number, cellY: number): boolean {
		this._updateAscii();
		if (!this._ascii) return false;

		const objX = Math.round(this.getProperty<number>('transform.x'));
		const objY = Math.round(this.getProperty<number>('transform.y'));
		const objWidth = Math.round(this.getProperty<number>('transform.width'));
		const objHeight = Math.round(this.getProperty<number>('transform.height'));

		const cX = Math.floor(cellX);
		const cY = Math.floor(cellY);

		if (cX < objX || cX >= objX + objWidth || cY < objY || cY >= objY + objHeight) {
			return false;
		}

		const line = this._ascii.split('\n')[cY - objY];
		if (!line) return false;
		const char = line[cX - objX];
		return Boolean(char) && char !== ' ';
	}

	public regionHitTest(region: CellRectangle): boolean {
		const objX = Math.round(this.getProperty<number>('transform.x'));
		const objY = Math.round(this.getProperty<number>('transform.y'));
		const objWidth = Math.round(this.getProperty<number>('transform.width'));
		const objHeight = Math.round(this.getProperty<number>('transform.height'));

		return (
			region.cellX < objX + objWidth &&
			region.cellX + region.width > objX &&
			region.cellY < objY + objHeight &&
			region.cellY + region.height > objY
		);
	}

	public clone(): ISmartObject {
		const cloned = new ImageAsciiObject({
			cellX: this.getProperty<number>('transform.x'),
			cellY: this.getProperty<number>('transform.y'),
			width: this.getProperty<number>('transform.width'),
			height: this.getProperty<number>('transform.height')
		});
		cloned.properties.setFromSnapshot(this.properties.snapshot());
		cloned.id = this.id;
		cloned._dataUrl = this._dataUrl;
		cloned._ascii = this._ascii;
		if (this._source) cloned._source = this._source;
		return cloned;
	}

	render({ skCanvas, canvasKit, fontManager, config, camera, opacity }: AsciiRenderingDeps): void {
		this._updateAscii();
		if (!this._ascii) return;

		const tx = this.getProperty<number>('transform.x');
		const ty = this.getProperty<number>('transform.y');
		if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

		const {
			dimensions: { height: charHeight, width: charWidth }
		} = fontManager.getMetrics();
		if (charWidth * camera.scale < 0.5 || charHeight * camera.scale < 0.5) return;

		const { foreground } = config.getTheme();
		const isPreview = this.getProperty('meta.preview');
		const fontCfg = fontManager.getCurrentFont().getConfig();
		const fontMgr = fontManager.getFontMgr();
		const matched = fontMgr.matchFamilyStyle(fontCfg.family, {
			weight: canvasKit.FontWeight.Normal,
			width: canvasKit.FontWidth.Normal,
			slant: canvasKit.FontSlant.Upright
		});
		const skFont = matched
			? new canvasKit.Font(matched, fontManager.getMetrics().size)
			: new canvasKit.Font(null, fontManager.getMetrics().size);
		skFont.setSubpixel(false);

		const baseAlpha = isPreview ? 0.5 : foreground[3];
		const paint = createPaint(
			canvasKit,
			[foreground[0], foreground[1], foreground[2], baseAlpha * (opacity ?? 1)],
			canvasKit.PaintStyle.Fill
		);

		const baseX = Math.round(tx) * charWidth;
		const baseY = Math.round(ty) * charHeight;
		const fm = skFont.getMetrics();
		const baselineOffset = fm && typeof fm.ascent === 'number' ? -fm.ascent : 0;

		const text = this._ascii;
		let glyphCount = 0;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (ch !== ' ' && ch !== '\n') glyphCount++;
		}
		if (glyphCount === 0) {
			paint.delete();
			return;
		}

		const allGids = (skFont as unknown as { getGlyphIDs(text: string): Uint16Array }).getGlyphIDs(
			text
		);
		const glyphs = new Uint16Array(glyphCount);
		const pos = new Float32Array(glyphCount * 2);

		let row = 0;
		let col = 0;
		let out = 0;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (ch === '\n') {
				row++;
				col = 0;
				continue;
			}
			if (ch === ' ') {
				col++;
				continue;
			}
			glyphs[out] = allGids[i];
			const p = out * 2;
			pos[p] = baseX + col * charWidth;
			pos[p + 1] = baseY + row * charHeight + baselineOffset;
			out++;
			col++;
		}

		if (out > 0) {
			(
				skCanvas as unknown as {
					drawGlyphs(
						glyphs: Uint16Array,
						pos: Float32Array,
						x: number,
						y: number,
						font: unknown,
						paint: unknown
					): void;
				}
			).drawGlyphs(glyphs, pos, 0, 0, skFont, paint);
		}

		paint.delete();
	}

	toJson(): ImageAsciiObjectData {
		return {
			dataUrl: this._dataUrl ?? undefined,
			ascii: this.toAsciiString()
		};
	}

	static deserialize(
		config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): ImageAsciiObject {
		void config;
		const transform = fullData?.properties?.transform;
		const obj = new ImageAsciiObject({
			cellX: transform?.x?.value ?? 0,
			cellY: transform?.y?.value ?? 0,
			width: Math.max(1, transform?.width?.value ?? 1),
			height: Math.max(1, transform?.height?.value ?? 1)
		});
		if (fullData?.id) obj.id = fullData.id;

		const payload = (data ?? {}) as ImageAsciiObjectData;
		obj._ascii = payload.ascii ?? '';
		obj._dataUrl = payload.dataUrl ?? null;

		// The cached text keeps the object visible while the bitmap is decoded;
		// the source is only needed again once a property changes.
		if (obj._dataUrl && typeof document !== 'undefined') {
			decodeDataUrl(obj._dataUrl)
				.then((source) => {
					obj._source = source;
					obj._cacheKey = null;
					obj._updateAscii();
					obj.emit('update');
				})
				.catch(() => {});
		}

		return obj;
	}
}
