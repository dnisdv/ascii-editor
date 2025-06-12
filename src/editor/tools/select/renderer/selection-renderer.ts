import type { ICamera, ICanvas, IRenderManager } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { SelectionModeContext } from '../modes/selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import { SelectionModeName } from '../modes/modes.type';

export class SelectionRenderer {
	private camera: ICamera;
	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;
	private paint: Paint;
	private rotateDotPaint: Paint;

	private selectCanvas: ICanvas;
	private renderManager: IRenderManager;

	constructor(
		private coreApi: CoreApi,
		private sessionManager: SelectionSessionManager,
		private modeCtx: SelectionModeContext
	) {
		this.camera = this.coreApi.getCamera();
		this.selectCanvas = this.coreApi.getCanvases().select;
		this.renderManager = this.coreApi.getRenderManager();

		const { canvasKit, skCanvas } = this.coreApi.getCanvases().select;
		this.canvasKit = canvasKit;
		this.skCanvas = skCanvas;

		const { primary } = this.coreApi.getConfig().getTheme();

		this.paint = new this.canvasKit.Paint();
		this.paint.setColor(this.canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3]));
		this.paint.setStyle(this.canvasKit.PaintStyle.Stroke);
		this.paint.setAntiAlias(true);

		this.rotateDotPaint = new canvasKit.Paint();
		this.rotateDotPaint.setStyle(canvasKit.PaintStyle.Fill);
		this.rotateDotPaint.setColor(canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3]));
		this.rotateDotPaint.setAntiAlias(true);

		this.camera.on('change', this.triggerDraw.bind(this));
		sessionManager.on('session::region_updated', this.triggerDraw.bind(this));
		sessionManager.on('manager::session_created', this.triggerDraw.bind(this));
		sessionManager.on('manager::session_destroyed', this.triggerDraw.bind(this));

		modeCtx.on('ctx::transitioned', this.triggerDraw.bind(this));

		this.renderManager.register(
			'tool::select',
			'draw',
			() => {
				this.drawSelection();
				this.drawRotationHandles();
			},
			this.selectCanvas
		);
	}

	public triggerDraw() {
		this.renderManager.requestRender();
	}

	private drawSelection() {
		const box = this.sessionManager.getActiveSession()?.getSelectedRegion();
		if (!box) {
			return;
		}

		this.drawSelectionOverlay({
			startX: box.startX,
			startY: box.startY,
			endX: box.startX + box.width,
			endY: box.startY + box.height
		});
	}

	private drawSelectionOverlay(selectedArea: {
		startX: number;
		startY: number;
		endX: number;
		endY: number;
	}): void {
		const activeSelectSession = this.sessionManager.getActiveSession();
		if (!activeSelectSession) {
			return;
		}

		const screenStart = this.camera.worldToScreen(selectedArea.startX, selectedArea.startY);
		const screenEnd = this.camera.worldToScreen(selectedArea.endX, selectedArea.endY);

		const rectCenterX = (screenStart.x + screenEnd.x) / 2;
		const rectCenterY = (screenStart.y + screenEnd.y) / 2;

		const rect = this.canvasKit.LTRBRect(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
		const rotatingCtxMode = this.modeCtx.getMode(SelectionModeName.ROTATING);

		if (!rotatingCtxMode) {
			return;
		}

		this.skCanvas.save();
		this.skCanvas.translate(rectCenterX, rectCenterY);
		this.skCanvas.rotate(rotatingCtxMode.getRotationAngle(), 0, 0);
		this.skCanvas.translate(-rectCenterX, -rectCenterY);
		this.skCanvas.drawRect(rect, this.paint);
		this.skCanvas.restore();
	}

	public clear(): void {
		this.renderManager.requestRenderFn(() => { });
	}

	public drawRotationHandles(): void {
		const activeSession = this.sessionManager.getActiveSession();
		if (!activeSession) return;

		const rotatingCtx = this.modeCtx.getMode(SelectionModeName.ROTATING)!;

		const selectedContent = activeSession.getSelectedContent();
		if (selectedContent && selectedContent.data.trim().length === 1) return;

		const isSelected = this.modeCtx.getCurrentModeName() === SelectionModeName.SELECTED;
		const isRotating = this.modeCtx.getCurrentModeName() === SelectionModeName.ROTATING;

		if (isSelected || isRotating) {
			const { startX, startY, width, height } = activeSession.getSelectedRegion()!;
			const rotationAngle = rotatingCtx.getRotationAngle();

			const screenOffset = rotatingCtx.getCornerOffset();
			const worldOffset = screenOffset;

			const offsetedStartX = startX - worldOffset;
			const offsetedStartY = startY - worldOffset;
			const offsetedEndX = startX + width + worldOffset;
			const offsetedEndY = startY + height + worldOffset;

			const corners = [
				{ x: offsetedStartX, y: offsetedStartY },
				{ x: offsetedEndX, y: offsetedEndY },
				{ x: offsetedStartX, y: offsetedEndY },
				{ x: offsetedEndX, y: offsetedStartY }
			];

			const skCanvas = this.selectCanvas.skCanvas;

			const screenStart = this.camera.worldToScreen(startX, startY);
			const screenEnd = this.camera.worldToScreen(startX + width, startY + height);

			const rectCenterX = (screenStart.x + screenEnd.x) / 2;
			const rectCenterY = (screenStart.y + screenEnd.y) / 2;

			const pixelRatio = this.camera.getPixelRatio();

			const effectiveDotRadius = rotatingCtx.getDotRadius() * Math.max(pixelRatio / 2, 1);
			const effectiveHoveredDotRadius =
				rotatingCtx.getHoveredDotRadius() * Math.max(pixelRatio / 2, 1);

			skCanvas.save();
			skCanvas.translate(rectCenterX, rectCenterY);
			skCanvas.rotate(rotationAngle, 0, 0);
			skCanvas.translate(-rectCenterX, -rectCenterY);

			if (this.modeCtx.getCurrentModeName() === SelectionModeName.ROTATING) {
				const hoveredCorner = rotatingCtx.getHoveredCorner();
				if (hoveredCorner !== null) {
					const corner = corners[hoveredCorner];
					const screenPos = this.camera.worldToScreen(corner.x, corner.y);
					skCanvas.drawCircle(
						screenPos.x,
						screenPos.y,
						effectiveHoveredDotRadius,
						this.rotateDotPaint
					);
				}
			} else {
				corners.forEach((corner, index) => {
					const screenPos = this.camera.worldToScreen(corner.x, corner.y);
					const radius =
						rotatingCtx.getHoveredCorner() === index
							? effectiveHoveredDotRadius
							: effectiveDotRadius;
					skCanvas.drawCircle(screenPos.x, screenPos.y, radius, this.rotateDotPaint);
				});
			}

			skCanvas.restore();
		}
	}
}
