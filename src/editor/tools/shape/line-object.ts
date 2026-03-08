import { BaseSmartObject } from '@editor/objects/smart-object.base';
import { StandardGroupKeys, TransformProperties } from '@editor/objects/properties';

import type { CellRectangle } from '@editor/types';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { Config } from '@editor/config';
import type {
	ISmartObject,
	SelectionOverlayDrawer,
	SmartObjectAnchor
} from '@editor/objects/smart-object.interface';
import { createPaint } from '@editor/utils/rendering';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

export class LineObject extends BaseSmartObject {
	readonly type = 'line';

	constructor(bounds: CellRectangle | unknown) {
		const b = (bounds as CellRectangle) ?? { cellX: 0, cellY: 0, width: 1, height: 1 };
		super(b, {
			capabilities: { canMove: true, canResize: false, canRotate: false, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: b.cellX },
					[TransformProperties.Y]: { type: 'number', value: b.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: Math.max(1, b.width) },
					[TransformProperties.HEIGHT]: { type: 'number', value: Math.max(1, b.height) },
					[TransformProperties.ROTATION]: { type: 'number', value: 0 }
				}
			}
		});

		this.setEndpointsFromCorners(
			{ x: b.cellX, y: b.cellY },
			{ x: b.cellX + Math.max(1, b.width) - 1, y: b.cellY + Math.max(1, b.height) - 1 }
		);
		this._recalculateFromAbs(this.getAnchorsAbs());
		this.ensureVisualAnchors();
	}

	public clone(): ISmartObject {
		const cloned = new LineObject({
			cellX: this.getProperty('transform.x'),
			cellY: this.getProperty('transform.y'),
			width: this.getProperty('transform.width'),
			height: this.getProperty('transform.height')
		});

		cloned.anchors = this.anchors.map((a) => ({ ...a }));
		cloned.properties.setFromSnapshot(this.properties.snapshot());
		cloned.id = this.id;
		return cloned;
	}

	public setEndpointsFromCorners(
		startCorner: { x: number; y: number },
		endCorner: { x: number; y: number }
	): void {
		const startPt = this.createAnchorForPoint({ x: startCorner.x, y: startCorner.y }, 'geometric');
		const midPt = this.createAnchorForPoint(
			{
				x: Math.floor((startCorner.x + endCorner.x) / 2),
				y: Math.floor((startCorner.y + endCorner.y) / 2)
			},
			'visual'
		);
		const endPt = this.createAnchorForPoint({ x: endCorner.x, y: endCorner.y }, 'geometric');
		this.anchors = [startPt, midPt, endPt];
		this._recalculateFromAbs(this.getAnchorsAbs());
		this.ensureVisualAnchors();
	}

	public getAnchors(): SmartObjectAnchor[] {
		const { x: objX, y: objY } = this.getTransformInts();

		const anchors = this.anchors.map((a) => ({
			...a,
			x: objX + a.x,
			y: objY + a.y
		}));

		return [...anchors];
	}

	private calculateBoundsFromAnchors(anchors: SmartObjectAnchor[]): CellRectangle {
		if (anchors.length < 2) return { cellX: 0, cellY: 0, width: 1, height: 1 };
		const xs = anchors.map((p) => p.x);
		const ys = anchors.map((p) => p.y);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);
		const width = maxX - minX + 1;
		const height = maxY - minY + 1;
		return { cellX: minX, cellY: minY, width, height };
	}

	private getTransformInts(): { x: number; y: number; w: number; h: number } {
		const x = Math.round(this.getProperty<number>('transform.x'));
		const y = Math.round(this.getProperty<number>('transform.y'));
		const w = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const h = Math.max(1, Math.round(this.getProperty<number>('transform.height')));
		return { x, y, w, h };
	}

	private getPolylineLocalPoints(w: number, h: number): Array<{ x: number; y: number }> {
		return this.anchors
			.filter((i) => i.type === 'geometric')
			.map((p) => ({ x: clamp(p.x, 0, w - 1), y: clamp(p.y, 0, h - 1) }));
	}

	private createAnchorForPoint(
		point: { x: number; y: number },
		type: SmartObjectAnchor['type']
	): SmartObjectAnchor {
		return {
			id: `${point.x},${point.y}`,
			x: Math.floor(point.x),
			y: Math.floor(point.y),
			cursor: 'crosshair',
			type: type,
			draggable: true
		};
	}

	private drawSegmentOnGrid(
		grid: string[][],
		width: number,
		height: number,
		a: { x: number; y: number },
		b: { x: number; y: number }
	): void {
		const ax = Math.round(a.x);
		const ay = Math.round(a.y);
		const bx = Math.round(b.x);
		const by = Math.round(b.y);

		const dxAbs = Math.abs(bx - ax);
		const dyAbs = Math.abs(by - ay);

		if (dyAbs === 0) {
			const y = ay;
			if (y < 0 || y >= height) return;
			const from = clamp(Math.min(ax, bx), 0, width - 1);
			const to = clamp(Math.max(ax, bx), 0, width - 1);
			for (let x = from; x <= to; x++) grid[y][x] = '─';
			return;
		}
		if (dxAbs === 0) {
			const x = ax;
			if (x < 0 || x >= width) return;
			const from = clamp(Math.min(ay, by), 0, height - 1);
			const to = clamp(Math.max(ay, by), 0, height - 1);
			for (let y = from; y <= to; y++) grid[y][x] = '│';
			return;
		}

		const slope = dyAbs / dxAbs;
		let char = '•';
		if (slope < 0.5) char = '─';
		else if (slope > 2.0) char = '│';
		else char = bx > ax === by > ay ? '\\' : '/';

		this.bresenham(ax, ay, bx, by, (x, y) => {
			if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = char;
		});
	}

	private getAnchorsAbs(): Array<{ x: number; y: number }> {
		const obj = this.getTransformInts();
		return this.anchors.map((p) => ({ x: obj.x + p.x, y: obj.y + p.y }));
	}

	public setAnchorsAbs(anchorsAbs: Array<{ x: number; y: number }>): void {
		if (anchorsAbs.length < 2) return;
		const xs = anchorsAbs.map((p) => p.x);
		const ys = anchorsAbs.map((p) => p.y);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);
		const width = maxX - minX + 1;
		const height = maxY - minY + 1;

		this.setProperty('transform.x', minX);
		this.setProperty('transform.y', minY);
		this.setProperty('transform.width', width);
		this.setProperty('transform.height', height);

		this.anchors = anchorsAbs.map((abs, i) => {
			const prev = this.anchors[i];
			return {
				id: prev?.id ?? `${abs.x},${abs.y}`,
				x: clamp(abs.x - minX, 0, width - 1),
				y: clamp(abs.y - minY, 0, height - 1),
				cursor: prev?.cursor ?? 'crosshair',
				type: prev?.type ?? 'geometric',
				draggable: prev?.draggable ?? true
			};
		});

		this.commitProperties();
	}

	private buildStringCurrent(): string {
		const { w: width, h: height } = this.getTransformInts();
		const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
		const points = this.getPolylineLocalPoints(width, height);
		for (let i = 0; i < points.length - 1; i++)
			this.drawSegmentOnGrid(grid, width, height, points[i], points[i + 1]);
		return grid.map((row) => row.join('')).join('\n');
	}

	private bresenham(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		plot: (x: number, y: number) => void
	) {
		const dx = Math.abs(x1 - x0);
		const sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0);
		const sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		while (true) {
			plot(x0, y0);
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
	}

	public toString(): string {
		return this.buildStringCurrent();
	}

	public hitTest(cellX: number, cellY: number): boolean {
		const objX = Math.round(this.getProperty<number>('transform.x'));
		const objY = Math.round(this.getProperty<number>('transform.y'));
		const w = Math.round(this.getProperty<number>('transform.width'));
		const h = Math.round(this.getProperty<number>('transform.height'));

		const cX = Math.floor(cellX);
		const cY = Math.floor(cellY);
		if (cX < objX || cX >= objX + w || cY < objY || cY >= objY + h) return false;

		const localX = cX - objX;
		const localY = cY - objY;
		const lines = this.buildStringCurrent().split('\n');
		if (localY >= lines.length) return false;
		const line = lines[localY];
		if (localX >= line.length) return false;
		return line[localX] !== ' ';
	}

	public regionHitTest(region: CellRectangle): boolean {
		const objX = Math.round(this.getProperty<number>('transform.x'));
		const objY = Math.round(this.getProperty<number>('transform.y'));
		const w = Math.round(this.getProperty<number>('transform.width'));
		const h = Math.round(this.getProperty<number>('transform.height'));

		const intersects =
			region.cellX < objX + w &&
			region.cellX + region.width > objX &&
			region.cellY < objY + h &&
			region.cellY + region.height > objY;

		if (!intersects) return false;

		const lines = this.buildStringCurrent().split('\n');
		const left = Math.max(region.cellX, objX);
		const top = Math.max(region.cellY, objY);
		const right = Math.min(region.cellX + region.width, objX + w);
		const bottom = Math.min(region.cellY + region.height, objY + h);
		for (let y = top; y < bottom; y++) {
			const ly = y - objY;
			const row = lines[ly] ?? '';
			for (let x = left; x < right; x++) {
				const lx = x - objX;
				if (row[lx] && row[lx] !== ' ') return true;
			}
		}
		return false;
	}

	public hitTestMoveArea(cellX: number, cellY: number): boolean {
		return this.hitTest(cellX, cellY);
	}

	render({ skCanvas, canvasKit, fontManager, config, camera, opacity }: AsciiRenderingDeps): void {
		const tx = this.getProperty<number>('transform.x');
		const ty = this.getProperty<number>('transform.y');
		if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

		const text = this.buildStringCurrent();

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
		const font = new canvasKit.Font(matched, fontManager.getMetrics().size);
		font.setSubpixel(false);

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

		const fm = font.getMetrics();
		const baselineOffset = fm && typeof fm.ascent === 'number' ? -fm.ascent : 0;

		let glyphCount = 0;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (ch !== ' ' && ch !== '\n') glyphCount++;
		}
		if (glyphCount === 0) {
			paint.delete();
			return;
		}

		const allGids = (font as unknown as { getGlyphIDs(text: string): Uint16Array }).getGlyphIDs(
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
			).drawGlyphs(glyphs, pos, 0, 0, font, paint);
		}

		paint.delete();
	}

	public override renderSelectionOverlay(draw: SelectionOverlayDrawer): boolean {
		const absAnchors = this.getAnchors().filter((a) => a.type === 'geometric');
		if (absAnchors.length < 2) return false;
		for (let i = 0; i < absAnchors.length - 1; i++) {
			const a = absAnchors[i];
			const b = absAnchors[i + 1];
			draw.lineCell(a.x, a.y, b.x, b.y);
		}
		return true;
	}

	public hitTestAnchor(cellX: number, cellY: number): SmartObjectAnchor | null {
		const anchors = this.getAnchors();
		const x = Math.floor(cellX);
		const y = Math.floor(cellY);

		for (const a of anchors) {
			if (a.x === x && a.y === y) {
				return a;
			}
		}
		return null;
	}

	private updateAnchorAbs(anchorId: string, toCellX: number, toCellY: number): void {
		const anchorIdx = this.getAnchors().findIndex((a) => a.id === anchorId);

		this.anchors[anchorIdx] = {
			...this.anchors[anchorIdx],
			x: Math.floor(toCellX) - this.getTransformInts().x,
			y: Math.floor(toCellY) - this.getTransformInts().y,
			type: 'geometric'
		};

		this._recalculateFromAbs(this.getAnchorsAbs());
		this.ensureVisualAnchors();
	}

	public moveAnchor(anchorId: string, toCellX: number, toCellY: number): void {
		const allAnchors = this.getAnchors();

		const anchor = allAnchors.find((a) => a.id === anchorId);
		const idx = allAnchors.findIndex((a) => a.id === anchorId);

		if (!anchor || idx === -1) {
			console.warn(`No anchor found with id: ${anchorId}`);
			return;
		}

		this.updateAnchorAbs(anchorId, toCellX, toCellY);
		this.commitProperties();

		this.emit('update');
	}

	toJson() {
		const geom = this.anchors.filter((a) => a.type === 'geometric');
		const geometricAnchors = geom.map((a) => ({ x: a.x, y: a.y }));
		return { geometricAnchors } as unknown as SerializedSmartObjectData['data'];
	}

	private ensureVisualAnchors(): void {
		const { x: ox, y: oy } = this.getTransformInts();
		const toAbs = (a: SmartObjectAnchor) => ({ ...a, x: a.x + ox, y: a.y + oy });
		const fromAbs = (a: SmartObjectAnchor & { x: number; y: number }) => ({
			...a,
			x: a.x - ox,
			y: a.y - oy
		});

		const absAnchors = this.anchors.map((a) => toAbs(a));
		const geom = absAnchors.filter((a) => a.type === 'geometric');
		if (geom.length < 2) {
			this.anchors = geom.map((a) => fromAbs(a));
			return;
		}

		const newAbs: SmartObjectAnchor[] = [];
		for (let i = 0; i < geom.length; i++) {
			const g = geom[i];
			newAbs.push(g);
			if (i < geom.length - 1) {
				const n = geom[i + 1];
				const mx = Math.floor((g.x + n.x) / 2);
				const my = Math.floor((g.y + n.y) / 2);
				const visualId = `v:${g.id}|${n.id}`;
				newAbs.push({
					id: visualId,
					x: mx,
					y: my,
					cursor: 'crosshair',
					type: 'visual',
					draggable: true
				});
			}
		}

		this.anchors = newAbs.map((a) => fromAbs(a));
	}

	private _recalculateFromAbs(anchorsAbs: Array<{ x: number; y: number }>): void {
		if (anchorsAbs.length === 0) return;
		const xs = anchorsAbs.map((p) => p.x);
		const ys = anchorsAbs.map((p) => p.y);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);
		const width = maxX - minX + 1;
		const height = maxY - minY + 1;
		this.setProperty('transform.x', minX);
		this.setProperty('transform.y', minY);
		this.setProperty('transform.width', width);
		this.setProperty('transform.height', height);
		this.anchors = this.anchors.map((a, i) => {
			const abs = anchorsAbs[i] ?? { x: minX, y: minY };
			return { ...a, x: clamp(abs.x - minX, 0, width - 1), y: clamp(abs.y - minY, 0, height - 1) };
		});
	}

	static deserialize(
		config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): LineObject {
		const props = fullData?.properties as
			| Record<string, Record<string, { value: number }>>
			| undefined;
		const tx = props?.transform?.x?.value ?? data?.x ?? 0;
		const ty = props?.transform?.y?.value ?? data?.y ?? 0;
		const tw = Math.max(1, props?.transform?.width?.value ?? data?.width ?? 1);
		const th = Math.max(1, props?.transform?.height?.value ?? data?.height ?? 1);

		const obj = new LineObject({ cellX: tx, cellY: ty, width: tw, height: th });

		const pts: Array<{ x: number; y: number }> | undefined = Array.isArray(
			(fullData?.data ?? data)?.geometricAnchors
		)
			? (fullData?.data ?? data).geometricAnchors
			: undefined;
		if (pts && pts.length >= 2) {
			const relAnchors = pts.map((p) => ({
				id: `${p.x},${p.y}`,
				x: clamp(p.x, 0, tw - 1),
				y: clamp(p.y, 0, th - 1),
				cursor: 'crosshair',
				type: 'geometric' as const,
				draggable: true
			}));
			obj.anchors = relAnchors;
			obj.ensureVisualAnchors();
		} else {
			obj.setEndpointsFromCorners({ x: tx, y: ty }, { x: tx + tw - 1, y: ty + th - 1 });
		}

		return obj;
	}
}
