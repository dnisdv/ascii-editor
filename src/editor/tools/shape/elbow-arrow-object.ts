import { BaseSmartObject } from '@editor/objects/smart-object.base';
import { AppearanceProperties, StandardGroupKeys, TransformProperties } from '@editor/objects/properties';
import type { CellRectangle } from '@editor/types';
import type { AsciiRenderingDeps } from '@editor/canvas/strategies/ascii-rendering-strategy';
import type { Config } from '@editor/config';
import type {
	ISmartObject,
	SelectionOverlayDrawer,
	SmartObjectAnchor
} from '@editor/objects/smart-object.interface';
import type {
	SerializedSmartObjectData,
	SmartObjectSerializableSchemaType
} from '@editor/serializer/smart-object.schema';
import { createPaint } from '@editor/utils/rendering';

type Point = { x: number; y: number };
type Dir = 'r' | 'l' | 'd' | 'u';
type Routing = 'hvh' | 'vhv';

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function getDir(from: Point, to: Point): Dir {
	if (from.x === to.x) return from.y < to.y ? 'd' : 'u';
	return from.x < to.x ? 'r' : 'l';
}

function isHorizontal(a: Point, b: Point): boolean {
	return a.y === b.y;
}

function cleanPath(pts: Point[]): Point[] {
	if (pts.length < 2) return pts;

	let out: Point[] = [pts[0]];
	for (let i = 1; i < pts.length; i++) {
		const prev = out[out.length - 1];
		if (pts[i].x !== prev.x || pts[i].y !== prev.y) out.push(pts[i]);
	}
	if (out.length < 2) return out;

	let changed = true;
	while (changed) {
		changed = false;
		const next: Point[] = [out[0]];
		for (let i = 1; i < out.length - 1; i++) {
			const prev = next[next.length - 1];
			const curr = out[i];
			const nx = out[i + 1];
			const prevH = prev.y === curr.y;
			const nextH = curr.y === nx.y;
			const prevV = prev.x === curr.x;
			const nextV = curr.x === nx.x;
			if ((prevH && nextH) || (prevV && nextV)) {
				changed = true;
			} else {
				next.push(curr);
			}
		}
		next.push(out[out.length - 1]);
		out = next;
	}

	return out.length >= 2 ? out : pts.slice(0, 2);
}

function buildDefaultPath(start: Point, end: Point): Point[] {
	const dx = Math.abs(end.x - start.x);
	const dy = Math.abs(end.y - start.y);
	const routing: Routing = dy > dx ? 'vhv' : 'hvh';

	if (routing === 'hvh') {
		const midX = Math.round((start.x + end.x) / 2);
		return cleanPath([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
	} else {
		const midY = Math.round((start.y + end.y) / 2);
		return cleanPath([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
	}
}

export class ElbowArrowObject extends BaseSmartObject {
	readonly type = 'elbow-arrow';

	private _ptsLocal: Point[] = [];
	private _segDragBase: { anchorId: string; pts: Point[] } | null = null;
	private _stringCache: string | null = null;

	constructor(bounds: CellRectangle | unknown) {
		const b = (bounds as CellRectangle) ?? { cellX: 0, cellY: 0, width: 1, height: 1 };
		super(b, {
			capabilities: { canMove: true, canResize: false, canRotate: false, canSelect: true },
			properties: {
				[StandardGroupKeys.TRANSFORM]: {
					[TransformProperties.X]: { type: 'number', value: b.cellX },
					[TransformProperties.Y]: { type: 'number', value: b.cellY },
					[TransformProperties.WIDTH]: { type: 'number', value: Math.max(1, b.width) },
					[TransformProperties.HEIGHT]: { type: 'number', value: Math.max(1, b.height) }
				},
				[StandardGroupKeys.APPEARANCE]: {
					[AppearanceProperties.HORIZONTAL]:    { type: 'string', value: '─' },
					[AppearanceProperties.VERTICAL]:      { type: 'string', value: '│' },
					[AppearanceProperties.TOP_LEFT]:      { type: 'string', value: '┌' },
					[AppearanceProperties.TOP_RIGHT]:     { type: 'string', value: '┐' },
					[AppearanceProperties.BOTTOM_LEFT]:   { type: 'string', value: '└' },
					[AppearanceProperties.BOTTOM_RIGHT]:  { type: 'string', value: '┘' },
					[AppearanceProperties.ARROW_RIGHT]:   { type: 'string', value: '>' },
					[AppearanceProperties.ARROW_LEFT]:    { type: 'string', value: '<' },
					[AppearanceProperties.ARROW_DOWN]:    { type: 'string', value: 'v' },
					[AppearanceProperties.ARROW_UP]:      { type: 'string', value: '^' },
				}
			}
		});

		const start = { x: b.cellX, y: b.cellY };
		const end = { x: b.cellX + Math.max(1, b.width) - 1, y: b.cellY + Math.max(1, b.height) - 1 };
		const absPts = buildDefaultPath(start, end);
		this._applyAbsPts(absPts);
		this._syncAnchors();
	}

	public override setProperty(path: string, value: unknown): void {
		if (path.startsWith('appearance.')) this._stringCache = null;
		super.setProperty(path, value);
	}

	private _ox(): number {
		return Math.round(this.getProperty<number>('transform.x'));
	}
	private _oy(): number {
		return Math.round(this.getProperty<number>('transform.y'));
	}

	private _absPts(): Point[] {
		const ox = this._ox();
		const oy = this._oy();
		return this._ptsLocal.map((p) => ({ x: p.x + ox, y: p.y + oy }));
	}

	private _applyAbsPts(newAbsPts: Point[]): void {
		if (newAbsPts.length < 2) return;
		this._stringCache = null;
		const xs = newAbsPts.map((p) => p.x);
		const ys = newAbsPts.map((p) => p.y);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);

		this.setProperty('transform.x', minX);
		this.setProperty('transform.y', minY);
		this.setProperty('transform.width', Math.max(1, maxX - minX + 1));
		this.setProperty('transform.height', Math.max(1, maxY - minY + 1));

		this._ptsLocal = newAbsPts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
	}

	public setFromAbsPoints(start: Point, end: Point): void {
		this._segDragBase = null;
		const absPts = buildDefaultPath(start, end);
		this._applyAbsPts(absPts);
		this.commitProperties();
		this._syncAnchors();
		this.emit('update');
	}

	private _syncAnchors(): void {
		const n = this._ptsLocal.length;
		const anchors: SmartObjectAnchor[] = [];

		for (let i = 0; i < n; i++) {
			const p = this._ptsLocal[i];
			const isEndpoint = i === 0 || i === n - 1;

			let cursor = 'crosshair';
			if (!isEndpoint) {
				const prev = this._ptsLocal[i - 1];
				cursor = prev.y === p.y ? 'ew-resize' : 'ns-resize';
			}

			anchors.push({
				id: `p:${i}`,
				x: p.x,
				y: p.y,
				cursor,
				type: isEndpoint ? 'geometric' : 'control',
				draggable: true
			});
		}

		for (let i = 0; i < n - 1; i++) {
			const a = this._ptsLocal[i];
			const b = this._ptsLocal[i + 1];
			const mx = Math.round((a.x + b.x) / 2);
			const my = Math.round((a.y + b.y) / 2);
			const segIsH = a.y === b.y;
			anchors.push({
				id: `seg:${i}`,
				x: mx,
				y: my,
				cursor: segIsH ? 'ns-resize' : 'ew-resize',
				type: 'visual',
				draggable: true
			});
		}

		this.anchors = anchors;
	}

	public getAnchors(): SmartObjectAnchor[] {
		const ox = this._ox();
		const oy = this._oy();
		return this.anchors.map((a) => ({ ...a, x: a.x + ox, y: a.y + oy }));
	}

	public onAnchorDragStart(_anchorId: string): void {
		this._segDragBase = null;
	}

	public hitTestAnchor(cellX: number, cellY: number): SmartObjectAnchor | null {
		const x = Math.floor(cellX);
		const y = Math.floor(cellY);
		const all = this.getAnchors();
		const seg = all.find((a) => a.id.startsWith('seg:') && a.x === x && a.y === y);
		if (seg) return { ...seg };
		const pt = all.find((a) => a.x === x && a.y === y);
		return pt ? { ...pt } : null;
	}

	public moveAnchor(anchorId: string, toCellX: number, toCellY: number): void {
		const cx = Math.round(toCellX);
		const cy = Math.round(toCellY);

		if (anchorId.startsWith('p:')) {
			this._segDragBase = null;
			this._moveWaypoint(parseInt(anchorId.slice(2)), cx, cy);
		} else if (anchorId.startsWith('seg:')) {
			if (this._segDragBase?.anchorId !== anchorId) {
				this._segDragBase = { anchorId, pts: this._absPts() };
			}
			this._slideOrSplitSegment(this._segDragBase.pts, parseInt(anchorId.slice(4)), cx, cy);
		}

		this.commitProperties();
		this._syncAnchors();
		this.emit('update');
	}

	private _moveWaypoint(idx: number, cx: number, cy: number): void {
		const pts = this._absPts();
		const n = pts.length;
		if (n < 2) return;
		const i = Math.min(idx, n - 1);

		if (i === 0 || i === n - 1) {
			this._moveEndpoint(pts, i, cx, cy);
		} else {
			this._moveJunction(pts, i, cx, cy);
		}
	}

	private _moveEndpoint(pts: Point[], i: number, cx: number, cy: number): void {
		const n = pts.length;
		const isStart = i === 0;

		if (n === 2) {
			const newPath = isStart
				? buildDefaultPath({ x: cx, y: cy }, pts[1])
				: buildDefaultPath(pts[0], { x: cx, y: cy });
			this._applyAbsPts(newPath);
			return;
		}

		if (isStart) {
			const adj = pts[1];
			const segIsH = isHorizontal(pts[0], adj);
			pts[0] = { x: cx, y: cy };
			pts[1] = segIsH ? { x: adj.x, y: cy } : { x: cx, y: adj.y };
		} else {
			const adj = pts[n - 2];
			const segIsH = isHorizontal(adj, pts[n - 1]);
			pts[n - 1] = { x: cx, y: cy };
			pts[n - 2] = segIsH ? { x: adj.x, y: cy } : { x: cx, y: adj.y };
		}

		this._applyAbsPts(cleanPath(pts));
	}

	private _moveJunction(pts: Point[], i: number, cx: number, cy: number): void {
		const prev = pts[i - 1];
		const next = pts[i + 1];
		const junctionIsH = prev.y === pts[i].y;

		if (junctionIsH) {
			pts[i] = { x: cx, y: pts[i].y };
			pts[i + 1] = { x: cx, y: next.y };
		} else {
			pts[i] = { x: pts[i].x, y: cy };
			pts[i + 1] = { x: next.x, y: cy };
		}

		this._applyAbsPts(cleanPath(pts));
	}

	private _slideOrSplitSegment(basePts: Point[], segIdx: number, cx: number, cy: number): void {
		const pts = basePts.map((p) => ({ ...p }));
		const n = pts.length;

		if (segIdx < 0 || segIdx >= n - 1) return;

		const p = pts[segIdx];
		const q = pts[segIdx + 1];
		const segH = isHorizontal(p, q);
		const isFirst = segIdx === 0;
		const isLast = segIdx === n - 2;

		if (segH) {
			if (!isFirst && !isLast) {
				pts[segIdx] = { x: p.x, y: cy };
				pts[segIdx + 1] = { x: q.x, y: cy };
			} else if (isFirst) {
				pts.splice(1, 0, { x: p.x, y: cy }, { x: q.x, y: cy });
			} else {
				pts.splice(n - 1, 0, { x: p.x, y: cy }, { x: q.x, y: cy });
			}
		} else {
			if (!isFirst && !isLast) {
				pts[segIdx] = { x: cx, y: p.y };
				pts[segIdx + 1] = { x: cx, y: q.y };
			} else if (isFirst) {
				pts.splice(1, 0, { x: cx, y: p.y }, { x: cx, y: q.y });
			} else {
				pts.splice(n - 1, 0, { x: cx, y: p.y }, { x: cx, y: q.y });
			}
		}

		this._applyAbsPts(cleanPath(pts));
	}

	public setAnchorsAbs(anchors: Array<{ x: number; y: number }>): void {
		if (anchors.length < 3) return;
		const n = Math.round((anchors.length + 1) / 2);
		const waypoints = anchors.slice(0, n);
		this._applyAbsPts(cleanPath(waypoints));
		this.commitProperties();
		this._syncAnchors();
		this.emit('update');
	}

	private _buildGrid(): string[][] {
		const ox = this._ox();
		const oy = this._oy();
		const w = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const h = Math.max(1, Math.round(this.getProperty<number>('transform.height')));
		const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(' '));

		const hChar = (this.getProperty<string>('appearance.horizontal')  || '─').charAt(0);
		const vChar = (this.getProperty<string>('appearance.vertical')    || '│').charAt(0);
		const cornerChars: Record<string, string> = {
			'r,d': (this.getProperty<string>('appearance.topRight')    || '┐').charAt(0),
			'r,u': (this.getProperty<string>('appearance.bottomRight') || '┘').charAt(0),
			'l,d': (this.getProperty<string>('appearance.topLeft')     || '┌').charAt(0),
			'l,u': (this.getProperty<string>('appearance.bottomLeft')  || '└').charAt(0),
			'd,r': (this.getProperty<string>('appearance.bottomLeft')  || '└').charAt(0),
			'd,l': (this.getProperty<string>('appearance.bottomRight') || '┘').charAt(0),
			'u,r': (this.getProperty<string>('appearance.topLeft')     || '┌').charAt(0),
			'u,l': (this.getProperty<string>('appearance.topRight')    || '┐').charAt(0),
		};
		const arrowChars: Record<Dir, string> = {
			r: (this.getProperty<string>('appearance.arrowRight') || '>').charAt(0),
			l: (this.getProperty<string>('appearance.arrowLeft')  || '<').charAt(0),
			d: (this.getProperty<string>('appearance.arrowDown')  || 'v').charAt(0),
			u: (this.getProperty<string>('appearance.arrowUp')    || '^').charAt(0),
		};

		const pts = this._absPts();
		if (pts.length < 2) return grid;

		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];

			if (a.y === b.y) {
				const gy = a.y - oy;
				if (gy < 0 || gy >= h) continue;
				const x1 = clamp(Math.min(a.x, b.x) - ox, 0, w - 1);
				const x2 = clamp(Math.max(a.x, b.x) - ox, 0, w - 1);
				for (let x = x1; x <= x2; x++) if (grid[gy][x] === ' ') grid[gy][x] = hChar;
			} else {
				const gx = a.x - ox;
				if (gx < 0 || gx >= w) continue;
				const y1 = clamp(Math.min(a.y, b.y) - oy, 0, h - 1);
				const y2 = clamp(Math.max(a.y, b.y) - oy, 0, h - 1);
				for (let y = y1; y <= y2; y++) if (grid[y][gx] === ' ') grid[y][gx] = vChar;
			}
		}

		for (let i = 1; i < pts.length - 1; i++) {
			const inDir = getDir(pts[i - 1], pts[i]);
			const outDir = getDir(pts[i], pts[i + 1]);
			if (inDir === outDir) continue;
			const gx = pts[i].x - ox;
			const gy = pts[i].y - oy;
			if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
				grid[gy][gx] = cornerChars[`${inDir},${outDir}`] ?? '+';
			}
		}

		const last = pts[pts.length - 1];
		const prev = pts[pts.length - 2];
		const endDir = getDir(prev, last);
		const gx = last.x - ox;
		const gy = last.y - oy;
		if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
			grid[gy][gx] = arrowChars[endDir];
		}

		return grid;
	}

	private _buildString(): string {
		if (this._stringCache === null) {
			this._stringCache = this._buildGrid()
				.map((r) => r.join(''))
				.join('\n');
		}
		return this._stringCache;
	}

	public toString(): string {
		return this._buildString();
	}

	public hitTest(cellX: number, cellY: number): boolean {
		const cx = Math.floor(cellX);
		const cy = Math.floor(cellY);
		const pts = this._absPts();
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			if (a.y === b.y && cy === a.y && cx >= Math.min(a.x, b.x) && cx <= Math.max(a.x, b.x)) return true;
			if (a.x === b.x && cx === a.x && cy >= Math.min(a.y, b.y) && cy <= Math.max(a.y, b.y)) return true;
		}
		return false;
	}

	public regionHitTest(region: CellRectangle): boolean {
		const rx1 = region.cellX;
		const ry1 = region.cellY;
		const rx2 = region.cellX + region.width - 1;
		const ry2 = region.cellY + region.height - 1;
		const pts = this._absPts();
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			if (a.y === b.y) {
				const y = a.y;
				if (y < ry1 || y > ry2) continue;
				const x1 = Math.min(a.x, b.x);
				const x2 = Math.max(a.x, b.x);
				if (x1 <= rx2 && x2 >= rx1) return true;
			} else {
				const x = a.x;
				if (x < rx1 || x > rx2) continue;
				const y1 = Math.min(a.y, b.y);
				const y2 = Math.max(a.y, b.y);
				if (y1 <= ry2 && y2 >= ry1) return true;
			}
		}
		return false;
	}

	public hitTestMoveArea(cellX: number, cellY: number): boolean {
		return this.hitTest(cellX, cellY);
	}

	public override renderSelectionOverlay(draw: SelectionOverlayDrawer): boolean {
		const pts = this._absPts();
		for (let i = 0; i < pts.length - 1; i++) {
			draw.lineCell(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
		}
		return true;
	}

	public clone(): ISmartObject {
		const ox = this._ox();
		const oy = this._oy();
		const w = Math.max(1, Math.round(this.getProperty<number>('transform.width')));
		const h = Math.max(1, Math.round(this.getProperty<number>('transform.height')));
		const cloned = new ElbowArrowObject({ cellX: ox, cellY: oy, width: w, height: h });
		cloned._ptsLocal = this._ptsLocal.map((p) => ({ ...p }));
		cloned.properties.setFromSnapshot(this.properties.snapshot());
		cloned._syncAnchors();
		cloned.id = this.id;
		return cloned;
	}

	public toJson() {
		return {
			points: this._ptsLocal.map((p) => ({ x: p.x, y: p.y }))
		} as unknown as SerializedSmartObjectData['data'];
	}

	static deserialize(
		_config: Config,
		data: SerializedSmartObjectData,
		fullData?: SmartObjectSerializableSchemaType
	): ElbowArrowObject {
		const d = (fullData?.data ?? data) as { points?: Array<{ x: number; y: number }> } | undefined;
		const props = fullData?.properties as
			| Record<string, Record<string, { value: number }>>
			| undefined;

		const tx = props?.transform?.x?.value ?? 0;
		const ty = props?.transform?.y?.value ?? 0;
		const tw = Math.max(1, props?.transform?.width?.value ?? 10);
		const th = Math.max(1, props?.transform?.height?.value ?? 6);

		const obj = new ElbowArrowObject({ cellX: tx, cellY: ty, width: tw, height: th });

		if (d?.points && d.points.length >= 2) {
			obj._ptsLocal = d.points.map((p) => ({ x: p.x, y: p.y }));
			obj._syncAnchors();
		}

		return obj;
	}

	render({ skCanvas, canvasKit, fontManager, config, camera, opacity }: AsciiRenderingDeps): void {
		const tx = this.getProperty<number>('transform.x');
		const ty = this.getProperty<number>('transform.y');
		if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

		const text = this._buildString();

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
}
