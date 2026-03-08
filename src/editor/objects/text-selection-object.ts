import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { CanvasKit, Canvas as WasmCanvas, FontStyle } from 'canvaskit-wasm';
import { BaseSmartObject } from './smart-object.base';
import type { CellRectangle } from '@editor/types';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';
import { maybeCompressString, maybeDecompressString } from '@editor/utils/compression';
import type { ISmartObject } from './smart-object.interface';
import { StandardGroupKeys, TransformProperties } from './properties';

export class TextSelectionObject extends BaseSmartObject {
	readonly type = 'text-selection';
	public selectedText: string;

	constructor(bounds: CellRectangle, selectedText: string) {
		super(bounds, {
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: bounds.cellX },
					[TransformProperties.Y]: { type: 'number', value: bounds.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: bounds.width, min: 1 },
					[TransformProperties.HEIGHT]: { type: 'number', value: bounds.height, min: 1 },
					[TransformProperties.ROTATION]: { type: 'number', value: 0 }
				}
			},
			capabilities: {
				canMove: true,
				canResize: false,
				canRotate: true,
				canSelect: true
			}
		});
		this.setProperty('transform.x', bounds.cellX);
		this.setProperty('transform.y', bounds.cellY);
		this.setProperty('transform.width', bounds.width);
		this.setProperty('transform.height', bounds.height);

		this.selectedText = selectedText;
		this.syncTransformToContent();
	}

	public toString(): string {
		return this.selectedText || '';
	}

	private syncTransformToContent(): void {
		if (!this.selectedText) return;

		const linesRaw = this.selectedText.split('\n');
		const lines: string[] = [...linesRaw];
		while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
		const contentHeight = Math.max(1, lines.length);
		let contentWidth = 1;
		for (const line of lines) contentWidth = Math.max(contentWidth, line.length);

		const curW = Math.round(this.getProperty('transform.width'));
		const curH = Math.round(this.getProperty('transform.height'));
		if (curW !== contentWidth) this.setProperty('transform.width', contentWidth);
		if (curH !== contentHeight) this.setProperty('transform.height', contentHeight);
	}

	public hitTest(cellX: number, cellY: number): boolean {
		if (!this.selectedText) {
			return false;
		}

		const objX = Math.round(this.getProperty('transform.x'));
		const objY = Math.round(this.getProperty('transform.y'));
		const objWidth = Math.round(this.getProperty('transform.width'));
		const objHeight = Math.round(this.getProperty('transform.height'));

		const cX = Math.floor(cellX);
		const cY = Math.floor(cellY);

		if (cX < objX || cX >= objX + objWidth || cY < objY || cY >= objY + objHeight) {
			return false;
		}

		const localX = cX - objX;
		const localY = cY - objY;

		const lines = this.selectedText.split('\n');
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
		if (!this.selectedText) {
			return false;
		}

		const objBounds = {
			cellX: Math.round(this.getProperty('transform.x')),
			cellY: Math.round(this.getProperty('transform.y')),
			width: Math.round(this.getProperty('transform.width')),
			height: Math.round(this.getProperty('transform.height'))
		};

		const intersects =
			region.cellX < objBounds.cellX + objBounds.width &&
			region.cellX + region.width > objBounds.cellX &&
			region.cellY < objBounds.cellY + objBounds.height &&
			region.cellY + region.height > objBounds.cellY;

		if (!intersects) {
			return false;
		}

		const startX = Math.max(region.cellX, objBounds.cellX);
		const endX = Math.min(region.cellX + region.width, objBounds.cellX + objBounds.width);
		const startY = Math.max(region.cellY, objBounds.cellY);
		const endY = Math.min(region.cellY + region.height, objBounds.cellY + objBounds.height);

		for (let y = startY; y < endY; y++) {
			for (let x = startX; x < endX; x++) {
				if (this.hitTest(x, y)) {
					return true;
				}
			}
		}

		return false;
	}

	clone(): ISmartObject {
		const cloned = new TextSelectionObject(
			{
				cellX: this.getProperty('transform.x'),
				cellY: this.getProperty('transform.y'),
				width: this.getProperty('transform.width'),
				height: this.getProperty('transform.height')
			},
			this.selectedText
		);

		const rotation = this.getProperty('transform.rotation');
		if (typeof rotation === 'number') {
			cloned.setProperty('transform.rotation', rotation);
		}

		cloned.id = this.id;
		return cloned;
	}

	render(deps: AsciiRenderingDeps): void {
		if (!this.selectedText) return;
		const { fontManager, config, canvasKit, skCanvas, opacity } = deps;

		const {
			dimensions: { height: charHeight, width: charWidth }
		} = fontManager.getMetrics();
		const pxW = charWidth * deps.camera.scale;
		const pxH = charHeight * deps.camera.scale;
		if (pxW < 0.5 && pxH < 0.5) return;

		const { foreground } = config.getTheme();
		const fontCfg = fontManager.getCurrentFont().getConfig();

		const style = {} as unknown as FontStyle;
		const typeface = fontManager.getFontMgr().matchFamilyStyle(fontCfg.family, style);
		const font = new canvasKit.Font(typeface, fontManager.getMetrics().size);
		const paint = new canvasKit.Paint();
		paint.setColor(
			canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3] * (opacity ?? 1))
		);
		paint.setAntiAlias(false);

		const baseX = Math.round(this.getProperty('transform.x')) * charWidth;
		const baseY = Math.round(this.getProperty('transform.y')) * charHeight;

		const text = this.selectedText;
		type FontWithGlyphs = InstanceType<CanvasKit['Font']> & {
			getGlyphIDs: (s: string) => Uint16Array;
			getMetrics?: () => { ascent: number };
		};
		const fontEx = font as unknown as FontWithGlyphs;
		const gids = fontEx.getGlyphIDs(text);
		const fm = fontEx.getMetrics?.();
		const baseline = fm && typeof fm.ascent === 'number' ? -fm.ascent : 0;

		const gb = new Uint16Array(text.length);
		const pb = new Float32Array(text.length * 2);
		let count = 0;
		let row = 0;
		let col = 0;
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
			const gid = gids[i];
			if (gid === 0) {
				col++;
				continue;
			}
			gb[count] = gid;
			const p = count * 2;
			pb[p] = baseX + col * charWidth;
			pb[p + 1] = baseY + row * charHeight + baseline;
			count++;
			col++;
		}
		if (count > 0) {
			type CanvasWithGlyphs = WasmCanvas & {
				drawGlyphs: (
					glyphs: Uint16Array,
					positions: Float32Array,
					x: number,
					y: number,
					font: InstanceType<CanvasKit['Font']>,
					paint: InstanceType<CanvasKit['Paint']>
				) => void;
			};
			const skEx = skCanvas as unknown as CanvasWithGlyphs;
			skEx.drawGlyphs(gb.subarray(0, count), pb.subarray(0, count * 2), 0, 0, font, paint);
		}
	}

	public getPropertiesSchema(): Map<string, unknown> {
		return new Map();
	}

	toJson() {
		const payload = maybeCompressString(this.selectedText);
		return payload.compressed
			? { selectedTextCompressed: payload.data, codec: payload.codec }
			: { selectedText: payload.data };
	}

	static deserialize(
		_config: unknown,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): ISmartObject {
		const raw = data?.selectedText as string | undefined;
		const comp = data?.selectedTextCompressed as string | undefined;
		const codec = data?.codec;
		const selectedText = comp ? maybeDecompressString(comp, true, codec) : (raw ?? '');
		const x = fullData?.properties?.transform?.x?.value ?? 0;
		const y = fullData?.properties?.transform?.y?.value ?? 0;
		const width = fullData?.properties?.transform?.width?.value ?? 1;
		const height = fullData?.properties?.transform?.height?.value ?? 1;
		const obj = new TextSelectionObject({ cellX: x, cellY: y, width, height }, selectedText);

		if (fullData?.id) {
			obj.id = fullData.id;
		}

		obj.syncTransformToContent();

		return obj;
	}
}
