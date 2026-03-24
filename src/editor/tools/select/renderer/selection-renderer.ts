import type { ICamera, ICanvas, IRenderManager, WorldRegion } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { SelectionModeContext } from '../modes/selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import type { SelectionSession } from '@editor/select/session/selection-session';
import { cellToWorld } from '@editor/utils';
import type {
	ISmartObject,
	SelectionOverlayDrawer
} from '@editor/objects/smart-object.interface';
import {
	createFillPaint,
	createStrokePaint,
	drawAnchor,
	drawRotationHandle
} from '@editor/utils/rendering';
import { SelectionModeName } from '../modes/modes.type';
import type { RotatingMode } from '../modes/rotating.mode';

export class SelectionRenderer {
	private camera: ICamera;
	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;
	private paint: Paint;
	private anchorFillPaint: Paint;
	private anchorStrokePaint: Paint;
	private rotationHandleFillPaint: Paint;
	private rotationHandleStrokePaint: Paint;

	private selectCanvas: ICanvas;
	private renderManager: IRenderManager;
	private readonly baseStrokeWidth = 1;

	selectionRect: WorldRegion | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager,
		private modeCtx: SelectionModeContext
	) {
		this.camera = this.coreApi.getCamera();
		this.selectCanvas = this.coreApi.getCanvases().select;
		this.renderManager = this.coreApi.getRenderManager();

		const { canvasKit, skCanvas } = this.coreApi.getCanvases().select;
		this.canvasKit = canvasKit;
		this.skCanvas = skCanvas;

		const { primary } = this.coreApi.getConfig().getTheme();

		this.paint = createStrokePaint(this.canvasKit, primary, this.baseStrokeWidth);

		this.anchorFillPaint = createFillPaint(this.canvasKit, [1, 1, 1, 1]);
		this.anchorStrokePaint = createStrokePaint(this.canvasKit, primary, 1.25);

		this.rotationHandleFillPaint = createFillPaint(this.canvasKit, [1, 1, 1, 1]);
		this.rotationHandleStrokePaint = createStrokePaint(this.canvasKit, [0.22, 0.49, 0.97, 1], 2.25);

		this.camera.on('change', this.triggerDraw.bind(this));

		modeCtx.on('ctx::transitioned', this.triggerDraw.bind(this));
		this.selectionManager.on('session::changed', () => this.triggerDraw());
		this.selectionManager.on('manager::session_change', () => this.triggerDraw());
		this.selectionManager.on('manager::session_created', () => this.triggerDraw());
		this.selectionManager.on('manager::session_destroyed', () => this.triggerDraw());

		this.renderManager.register(
			'tool::select',
			'rect',
			() => {
				this.drawSelectionOverlays();
				this.drawAnchors();
			},
			this.selectCanvas
		);
	}

	public triggerDraw() {
		this.renderManager.requestRender();
	}

	public setSelectionRectangle(rect: WorldRegion | null): void {
		this.selectionRect = rect;
		this.coreApi.getRenderManager().requestRender();
	}

	public drawRect() {
		if (!this.selectionRect) return;
		const screenStart = this.camera.worldToScreen(this.selectionRect.x, this.selectionRect.y);
		const screenEnd = this.camera.worldToScreen(
			this.selectionRect.x + this.selectionRect.width,
			this.selectionRect.y + this.selectionRect.height
		);

		const rectCenterX = (screenStart.x + screenEnd.x) / 2;
		const rectCenterY = (screenStart.y + screenEnd.y) / 2;

		const rect = this.canvasKit.LTRBRect(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);

		this.skCanvas.save();
		this.skCanvas.translate(rectCenterX, rectCenterY);
		this.skCanvas.translate(-rectCenterX, -rectCenterY);
		this.skCanvas.drawRect(rect, this.paint);
		this.skCanvas.restore();
	}

	private drawSelectionOverlays(): void {
		const session = this.selectionManager.getActiveSession();

		if (session && !session.isEmpty()) {
			this.paint.setStrokeWidth(this.baseStrokeWidth);
			const dimensions = this.coreApi.getFontManager().getMetrics().dimensions;
			const objects = session.getSelectedObjects();

			if (this.isRotatingMode() && objects.length === 1 && objects[0].capabilities.canRotate) {
				this.drawRotatingModeOverlay(objects[0], dimensions);
			} else if (objects.length === 1) {
				this.drawSingleObjectOverlay(objects[0], dimensions);
			} else {
				this.drawMultiObjectOverlay(session, objects, dimensions);
			}
		}

		if (this.selectionRect) {
			this.paint.setStrokeWidth(this.baseStrokeWidth);
			this.drawRawRectangle(this.selectionRect);
		}
	}

	private drawRotatingModeOverlay(
		obj: ISmartObject,
		dimensions: { width: number; height: number }
	): void {
		const displayAngle = this.getRotatingMode()?.getDisplayAngle() ?? 0;

		const cellX = obj.getProperty<number>('transform.x');
		const cellY = obj.getProperty<number>('transform.y');
		const width = obj.getProperty<number>('transform.width');
		const height = obj.getProperty<number>('transform.height');

		const isSnapped = displayAngle % 90 === 0 && displayAngle !== 0;
		const norm = ((displayAngle % 360) + 360) % 360;

		let drawCellX = cellX, drawCellY = cellY, drawW = width, drawH = height, drawAngle = displayAngle;
		if (isSnapped && (norm === 90 || norm === 270)) {
			drawW = height;
			drawH = width;
			drawCellX = cellX + Math.round((width - drawW) / 2);
			drawCellY = cellY + Math.round((height - drawH) / 2);
			drawAngle = 0;
		} else if (isSnapped) {
			drawAngle = 0;
		}

		this.drawCellRect(drawCellX, drawCellY, drawW, drawH, dimensions, drawAngle);
	}

	private drawSingleObjectOverlay(
		obj: ISmartObject,
		dimensions: { width: number; height: number }
	): void {
		const drawer = this.buildDrawer(dimensions);
		const handled = obj.renderSelectionOverlay?.(drawer) ?? false;
		if (!handled) {
			drawer.rectCell(
				obj.getProperty<number>('transform.x'),
				obj.getProperty<number>('transform.y'),
				obj.getProperty<number>('transform.width'),
				obj.getProperty<number>('transform.height')
			);
		}
	}

	private drawMultiObjectOverlay(
		session: SelectionSession,
		objects: ISmartObject[],
		dimensions: { width: number; height: number }
	): void {
		const { cellX, cellY, width, height } = session.boundingBox;
		this.drawCellRect(cellX, cellY, width, height, dimensions);

		const drawer = this.buildDrawer(dimensions);
		for (const obj of objects) {
			obj.renderSelectionOverlay?.(drawer);
		}
	}

	private drawAnchors(): void {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return;

		const objs = session.getSelectedObjects();
		const char = this.coreApi.getFontManager().getMetrics().dimensions;

		this.drawObjectAnchors(objs, char);

		if (objs.length === 1) {
			if (objs[0].capabilities?.canRotate) this.drawRotationHandles(objs[0]);
			if (objs[0].capabilities?.canResize) this.drawResizeHandles(session.boundingBox, char);
		}
	}

	private drawObjectAnchors(
		objs: ISmartObject[],
		char: { width: number; height: number }
	): void {
		for (const obj of objs) {
			if (!obj.getAnchors) continue;
			for (const a of obj.getAnchors()) {
				const world = cellToWorld({ charWidth: char.width, charHeight: char.height, cellX: a.x, cellY: a.y });
				const screen = this.camera.worldToScreen(world.x + char.width / 2, world.y + char.height / 2);
				this.drawAnchor(screen.x, screen.y);
			}
		}
	}

	private drawRotationHandles(obj: ISmartObject): void {
		const rotatingMode = this.getRotatingMode();
		if (this.isRotatingMode()) {
			const positions = rotatingMode?.getDisplayHandlePositions();
			if (!positions) return;
			for (const pos of positions) {
				const screen = this.camera.worldToScreen(pos.x, pos.y);
				this.drawRotationHandle(screen.x, screen.y);
			}
			return;
		}

		const char = this.coreApi.getFontManager().getMetrics().dimensions;
		const anchors = obj.getRotationAnchors?.(char.width, char.height) ?? [];
		for (const a of anchors) {
			const world = cellToWorld({ charWidth: char.width, charHeight: char.height, cellX: a.x, cellY: a.y });
			const screen = this.camera.worldToScreen(world.x, world.y);
			this.drawRotationHandle(
				screen.x + (a.screenOffset?.x ?? 0),
				screen.y + (a.screenOffset?.y ?? 0)
			);
		}
	}

	private drawResizeHandles(
		bb: { cellX: number; cellY: number; width: number; height: number },
		char: { width: number; height: number }
	): void {
		if (bb.width <= 0 || bb.height <= 0) return;
		const start = cellToWorld({ charWidth: char.width, charHeight: char.height, cellX: bb.cellX, cellY: bb.cellY });
		const end = cellToWorld({ charWidth: char.width, charHeight: char.height, cellX: bb.cellX + bb.width, cellY: bb.cellY + bb.height });
		for (const corner of [
			{ x: start.x, y: start.y },
			{ x: end.x,   y: start.y },
			{ x: start.x, y: end.y   },
			{ x: end.x,   y: end.y   }
		]) {
			const screen = this.camera.worldToScreen(corner.x, corner.y);
			this.drawAnchor(screen.x, screen.y);
		}
	}

	private buildDrawer(
		dimensions: { width: number; height: number },
		rotation = 0
	): SelectionOverlayDrawer {
		return {
			rectCell: (cellX, cellY, width, height) =>
				this.drawCellRect(cellX, cellY, width, height, dimensions, rotation),
			lineCell: (x1, y1, x2, y2) =>
				this.drawCellLine(x1, y1, x2, y2, dimensions)
		};
	}

	private drawCellRect(
		cellX: number,
		cellY: number,
		width: number,
		height: number,
		dimensions: { width: number; height: number },
		rotation = 0
	): void {
		const start = cellToWorld({ charWidth: dimensions.width, charHeight: dimensions.height, cellX, cellY });
		const end = cellToWorld({ charWidth: dimensions.width, charHeight: dimensions.height, cellX: cellX + width, cellY: cellY + height });
		this.drawRawRectangle({ x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }, rotation);
	}

	private drawCellLine(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		dimensions: { width: number; height: number }
	): void {
		const w1 = cellToWorld({ charWidth: dimensions.width, charHeight: dimensions.height, cellX: x1, cellY: y1 });
		const w2 = cellToWorld({ charWidth: dimensions.width, charHeight: dimensions.height, cellX: x2, cellY: y2 });
		const s1 = this.camera.worldToScreen(w1.x, w1.y);
		const s2 = this.camera.worldToScreen(w2.x, w2.y);
		this.skCanvas.drawLine(s1.x, s1.y, s2.x, s2.y, this.paint);
	}

	private drawRawRectangle(rect: WorldRegion, rotation: number = 0): void {
		const screenStart = this.camera.worldToScreen(rect.x, rect.y);
		const screenEnd = this.camera.worldToScreen(rect.x + rect.width, rect.y + rect.height);

		const skRect = this.canvasKit.LTRBRect(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);

		this.skCanvas.save();

		if (rotation !== 0) {
			const centerX = screenStart.x + (screenEnd.x - screenStart.x) / 2;
			const centerY = screenStart.y + (screenEnd.y - screenStart.y) / 2;
			this.skCanvas.translate(centerX, centerY);
			this.skCanvas.rotate(rotation, 0, 0);
			this.skCanvas.translate(-centerX, -centerY);
		}

		this.skCanvas.drawRect(skRect, this.paint);
		this.skCanvas.restore();
	}

	private drawAnchor(screenX: number, screenY: number): void {
		drawAnchor(
			this.canvasKit,
			this.skCanvas,
			screenX,
			screenY,
			{ fillPaint: this.anchorFillPaint, strokePaint: this.anchorStrokePaint },
			this.camera.getPixelRatio()
		);
	}

	private drawRotationHandle(screenX: number, screenY: number): void {
		drawRotationHandle(
			this.canvasKit,
			this.skCanvas,
			screenX,
			screenY,
			{ fillPaint: this.rotationHandleFillPaint, strokePaint: this.rotationHandleStrokePaint },
			this.camera.getPixelRatio()
		);
	}

	private isRotatingMode(): boolean {
		return this.modeCtx.getCurrentModeName() === SelectionModeName.ROTATING;
	}

	private getRotatingMode(): RotatingMode | undefined {
		return this.modeCtx.getMode(SelectionModeName.ROTATING) as RotatingMode | undefined;
	}

	public clear(): void {
		this.renderManager.requestRenderFn(() => {});
	}
}
