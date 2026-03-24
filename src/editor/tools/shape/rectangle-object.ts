import { BaseSmartObject } from '@editor/objects/smart-object.base';
import { StandardGroupKeys, TransformProperties } from '@editor/objects/properties';
import type { IRotatable, RotationStep } from '@editor/objects/smart-object.interface';

import type { CellRectangle } from '@editor/types';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { Config } from '@editor/config';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';
import { createPaint } from '@editor/utils/rendering';

export class RectangleObject extends BaseSmartObject implements IRotatable {
	readonly type = 'rectangle';
	private _rectangleString: string | null = null;

	constructor(bounds: CellRectangle | unknown) {
		const b = (bounds as CellRectangle) ?? { cellX: 0, cellY: 0, width: 1, height: 1 };
		super(b, {
			capabilities: { canMove: true, canResize: true, canRotate: true, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: b.cellX },
					[TransformProperties.Y]: { type: 'number', value: b.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: b.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: b.height, min: 1 },
				}
			}
		});
		this._updateRectangleString();
	}

	public toAsciiString(): string | null {
		this._updateRectangleString();
		return this._rectangleString;
	}

	public toString(): string {
		return this.toAsciiString() ?? '';
	}

	public hitTest(cellX: number, cellY: number): boolean {
		if (!this._rectangleString) {
			return false;
		}

		const objX = Math.round(this.getProperty<number>('transform.x'));
		const objY = Math.round(this.getProperty<number>('transform.y'));
		const objWidth = Math.round(this.getProperty<number>('transform.width'));
		const objHeight = Math.round(this.getProperty<number>('transform.height'));

		const cX = Math.floor(cellX);
		const cY = Math.floor(cellY);

		if (cX < objX || cX >= objX + objWidth || cY < objY || cY >= objY + objHeight) {
			return false;
		}

		const localX = cX - objX;
		const localY = cY - objY;

		const lines = this._rectangleString.split('\n');
		if (localY >= lines.length) {
			return false;
		}

		const line = lines[localY];
		if (localX >= line.length) {
			return false;
		}

		return line[localX] !== ' ';
	}

	public regionHitTest(region: CellRectangle): boolean {
		const objBounds = {
			cellX: Math.round(this.getProperty<number>('transform.x')),
			cellY: Math.round(this.getProperty<number>('transform.y')),
			width: Math.round(this.getProperty<number>('transform.width')),
			height: Math.round(this.getProperty<number>('transform.height'))
		};

		const intersects =
			region.cellX < objBounds.cellX + objBounds.width &&
			region.cellX + region.width > objBounds.cellX &&
			region.cellY < objBounds.cellY + objBounds.height &&
			region.cellY + region.height > objBounds.cellY;

		if (!intersects) {
			return false;
		}

		if (objBounds.width <= 2 || objBounds.height <= 2) {
			return true;
		}

		const isInsideHollow =
			region.cellX >= objBounds.cellX + 1 &&
			region.cellX + region.width <= objBounds.cellX + objBounds.width - 1 &&
			region.cellY >= objBounds.cellY + 1 &&
			region.cellY + region.height <= objBounds.cellY + objBounds.height - 1;

		return !isInsideHollow;
	}

	private _updateRectangleString(): void {
		const width = Math.round(this.getProperty<number>('transform.width'));
		const height = Math.round(this.getProperty<number>('transform.height'));

		if (width < 1 || height < 1) {
			this._rectangleString = null;
			return;
		}

		if (width === 1 && height === 1) {
			this._rectangleString = '■';
			return;
		}

		if (height === 1) {
			this._rectangleString = '─'.repeat(width);
			return;
		}

		if (width === 1) {
			this._rectangleString = '│\n'.repeat(height - 1) + '│';
			return;
		}

		let rectangleStr = '┌' + '─'.repeat(width - 2) + '┐\n';
		for (let i = 0; i < height - 2; i++) {
			rectangleStr += '│' + ' '.repeat(width - 2) + '│\n';
		}
		rectangleStr += '└' + '─'.repeat(width - 2) + '┘';

		this._rectangleString = rectangleStr;
	}

	public applyRotation(degrees: RotationStep): void {
		const norm = ((degrees % 360) + 360) % 360;

		const x = this.getProperty<number>('transform.x');
		const y = this.getProperty<number>('transform.y');
		const w = this.getProperty<number>('transform.width');
		const h = this.getProperty<number>('transform.height');

		let newW = w;
		let newH = h;
		if (norm === 90 || norm === 270) {
			newW = h;
			newH = w;
		}

		const newX = x + Math.round((w - newW) / 2);
		const newY = y + Math.round((h - newH) / 2);

		this.properties.applyCommitted('transform.x', newX);
		this.properties.applyCommitted('transform.y', newY);
		this.properties.applyCommitted('transform.width', newW);
		this.properties.applyCommitted('transform.height', newH);
		this._updateRectangleString();
		this.emit('update');
	}

	public clone(): ISmartObject {
		const cloned = new RectangleObject({
			cellX: this.getProperty<number>('transform.x'),
			cellY: this.getProperty<number>('transform.y'),
			width: this.getProperty<number>('transform.width'),
			height: this.getProperty<number>('transform.height')
		});
		cloned.properties.setFromSnapshot(this.properties.snapshot());
		cloned.id = this.id;
		return cloned;
	}

	render({ skCanvas, canvasKit, fontManager, config, camera, opacity }: AsciiRenderingDeps): void {
		this._updateRectangleString();
		if (!this._rectangleString) return;

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
		const style = {
			weight: canvasKit.FontWeight.Normal,
			width: canvasKit.FontWidth.Normal,
			slant: canvasKit.FontSlant.Upright
		} as const;
		const matched = fontMgr.matchFamilyStyle(fontCfg.family, style);
		const skFont = matched
			? new canvasKit.Font(matched, fontManager.getMetrics().size)
			: new canvasKit.Font(null, fontManager.getMetrics().size);
		skFont.setSubpixel(false);

		const baseAlpha = isPreview ? 0.5 : foreground[3];
		const finalAlpha = baseAlpha * (opacity ?? 1);

		const paint = createPaint(
			canvasKit,
			[foreground[0], foreground[1], foreground[2], finalAlpha],
			canvasKit.PaintStyle.Fill
		);

		const baseX = Math.round(tx) * charWidth;
		const baseY = Math.round(ty) * charHeight;
		if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) {
			paint.delete();
			return;
		}
		const fm = skFont.getMetrics();
		const baselineOffset = fm && typeof fm.ascent === 'number' ? -fm.ascent : 0;

		const text = this._rectangleString;
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

	toJson() {
		return {};
	}

	static deserialize(
		config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): RectangleObject {
		if (fullData) {
			const x = fullData.properties.transform.x.value;
			const y = fullData.properties.transform.y.value;
			const width = Math.max(1, fullData.properties.transform.width.value);
			const height = Math.max(1, fullData.properties.transform.height.value);

			const obj = new RectangleObject({ cellX: x, cellY: y, width, height });
			if (fullData?.id) obj.id = fullData.id;
			return obj;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = data as Record<string, any>;
		const x = d?.x ?? 0;
		const y = d?.y ?? 0;
		const width = Math.max(1, d?.width ?? 1);
		const height = Math.max(1, d?.height ?? 1);
		return new RectangleObject({ cellX: x, cellY: y, width, height });
	}
}
