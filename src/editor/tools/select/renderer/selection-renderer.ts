import type { ICamera, ICanvas, IRenderManager, WorldRegion } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { SelectionModeContext } from '../modes/selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { cellToWorld } from '@editor/utils';
import type {
	SmartObjectAnchor,
	SelectionOverlayDrawer
} from '@editor/objects/smart-object.interface';
import { createFillPaint, createStrokePaint, drawAnchor } from '@editor/utils/rendering';

export class SelectionRenderer {
	private camera: ICamera;
	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;
	private paint: Paint;
	private anchorFillPaint: Paint;
	private anchorStrokePaint: Paint;

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
		const activeSession = this.selectionManager.getActiveSession();

		if (activeSession && !activeSession.isEmpty()) {
			this.paint.setStrokeWidth(this.baseStrokeWidth);

			const selectedObjects = activeSession.getSelectedObjects();

			const dimensions = this.coreApi.getFontManager().getMetrics().dimensions;
			const drawer: SelectionOverlayDrawer = {
				rectCell: (cellX, cellY, width, height) => {
					const startWorld = cellToWorld({
						charWidth: dimensions.width,
						charHeight: dimensions.height,
						cellX,
						cellY
					});
					const endWorld = cellToWorld({
						charWidth: dimensions.width,
						charHeight: dimensions.height,
						cellX: cellX + width,
						cellY: cellY + height
					});
					this.drawRawRectangle(
						{
							x: startWorld.x,
							y: startWorld.y,
							width: endWorld.x - startWorld.x,
							height: endWorld.y - startWorld.y
						},
						0
					);
				},
				lineCell: (x1, y1, x2, y2) => {
					const w1 = cellToWorld({
						charWidth: dimensions.width,
						charHeight: dimensions.height,
						cellX: x1,
						cellY: y1
					});
					const w2 = cellToWorld({
						charWidth: dimensions.width,
						charHeight: dimensions.height,
						cellX: x2,
						cellY: y2
					});
					const s1 = this.camera.worldToScreen(w1.x + 0, w1.y + 0);
					const s2 = this.camera.worldToScreen(w2.x + 0, w2.y + 0);
					this.skCanvas.drawLine(s1.x, s1.y, s2.x, s2.y, this.paint);
				}
			};

			if (selectedObjects.length === 1) {
				const obj = selectedObjects[0];
				const handled =
					typeof obj.renderSelectionOverlay === 'function'
						? (obj.renderSelectionOverlay(drawer) ?? false)
						: false;
				if (!handled) {
					const cellX = obj.getProperty<number>('transform.x');
					const cellY = obj.getProperty<number>('transform.y');
					const width = obj.getProperty<number>('transform.width');
					const height = obj.getProperty<number>('transform.height');
					drawer.rectCell(cellX, cellY, width, height);
				}
			} else {
				const { width: charWidth, height: charHeight } = dimensions;
				const bbStart = cellToWorld({
					charWidth,
					charHeight,
					cellX: activeSession.boundingBox.cellX,
					cellY: activeSession.boundingBox.cellY
				});
				const bbEnd = cellToWorld({
					charWidth,
					charHeight,
					cellX: activeSession.boundingBox.cellX + activeSession.boundingBox.width,
					cellY: activeSession.boundingBox.cellY + activeSession.boundingBox.height
				});
				this.drawRawRectangle(
					{ x: bbStart.x, y: bbStart.y, width: bbEnd.x - bbStart.x, height: bbEnd.y - bbStart.y },
					0
				);

				for (const obj of selectedObjects) {
					if (typeof obj.renderSelectionOverlay === 'function') {
						obj.renderSelectionOverlay(drawer);
					}
				}
			}
		}

		if (this.selectionRect) {
			this.paint.setStrokeWidth(this.baseStrokeWidth);
			this.drawRawRectangle(this.selectionRect);
		}
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

	private drawAnchors(): void {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return;

		const objs = session.getSelectedObjects();
		const char = this.coreApi.getFontManager().getMetrics().dimensions;

		for (const obj of objs) {
			if (!obj.getAnchors) continue;
			const anchors: SmartObjectAnchor[] = obj.getAnchors();
			for (const a of anchors) {
				const worldPos = cellToWorld({
					charWidth: char.width,
					charHeight: char.height,
					cellX: a.x,
					cellY: a.y
				});
				const screen = this.camera.worldToScreen(
					worldPos.x + char.width / 2,
					worldPos.y + char.height / 2
				);
				this.drawAnchor(screen.x, screen.y);
			}
		}

		const allResizable = objs.length === 1 && objs[0].capabilities?.canResize;
		if (allResizable) {
			const { cellX, cellY, width, height } = session.boundingBox;
			if (width > 0 && height > 0) {
				const bbStart = cellToWorld({
					charWidth: char.width,
					charHeight: char.height,
					cellX,
					cellY
				});
				const bbEnd = cellToWorld({
					charWidth: char.width,
					charHeight: char.height,
					cellX: cellX + width,
					cellY: cellY + height
				});

				const corners = [
					{ x: bbStart.x, y: bbStart.y },
					{ x: bbEnd.x, y: bbStart.y },
					{ x: bbStart.x, y: bbEnd.y },
					{ x: bbEnd.x, y: bbEnd.y }
				];

				for (const c of corners) {
					const screen = this.camera.worldToScreen(c.x, c.y);
					this.drawAnchor(screen.x, screen.y);
				}
			}
		}
	}

	private drawAnchor(screenX: number, screenY: number): void {
		drawAnchor(
			this.canvasKit,
			this.skCanvas,
			screenX,
			screenY,
			{
				fillPaint: this.anchorFillPaint,
				strokePaint: this.anchorStrokePaint
			},
			this.camera.getPixelRatio()
		);
	}

	public clear(): void {
		this.renderManager.requestRenderFn(() => {});
	}
}
