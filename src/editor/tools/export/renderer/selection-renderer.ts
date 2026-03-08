import type { ICamera, ICanvas, IRenderManager } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { SelectionModeContext } from '../modes/selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import { HandlePosition, SelectionModeName } from '../modes/modes.type';
import { SelectedMode } from '../modes/selected-mode';
import { createFillPaint, createStrokePaint, drawAnchor } from '@editor/utils/rendering';

type NormalizedRGBA = [number, number, number, number];

export interface ExportToolTheme {
	primary: NormalizedRGBA;
}

const defaultTheme: ExportToolTheme = {
	primary: [0, 0, 0, 0]
};

export class SelectionRenderer {
	private camera: ICamera;
	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;
	private paint: Paint;
	private hoveredPaint: Paint;
	private handleStrokePaint: Paint;
	private handleWhiteFillPaint: Paint;

	private selectCanvas: ICanvas;
	private renderManager: IRenderManager;
	private theme: ExportToolTheme;

	constructor(
		private coreApi: CoreApi,
		private sessionManager: SelectionSessionManager,
		private modeCtx: SelectionModeContext,
		private initialTheme?: ExportToolTheme
	) {
		this.camera = this.coreApi.getCamera();
		this.selectCanvas = this.coreApi.getCanvases().select;
		this.renderManager = this.coreApi.getRenderManager();

		const { canvasKit, skCanvas } = this.coreApi.getCanvases().select;
		this.canvasKit = canvasKit;
		this.skCanvas = skCanvas;

		this.theme = this.initialTheme || defaultTheme;
		const { primary } = this.theme;

		this.paint = createStrokePaint(this.canvasKit, primary, 1);

		this.hoveredPaint = createStrokePaint(this.canvasKit, primary, 1.5);

		this.handleStrokePaint = createStrokePaint(this.canvasKit, primary, 1);

		this.handleWhiteFillPaint = createFillPaint(this.canvasKit, [1, 1, 1, 1]);

		sessionManager.on('session::region_updated', this.triggerDraw.bind(this));
		sessionManager.on('manager::session_created', this.triggerDraw.bind(this));
		sessionManager.on('manager::session_destroyed', this.triggerDraw.bind(this));
		modeCtx.on('ctx::transitioned', this.triggerDraw.bind(this));
		this.camera.on('change', this.triggerDraw.bind(this));

		this.renderManager.register(
			'tool::export',
			'draw',
			this.drawSelection.bind(this),
			this.selectCanvas
		);
	}

	public setTheme(theme: ExportToolTheme): void {
		this.theme = theme;
		this.updatePaints();
	}

	private updatePaints(): void {
		const { primary } = this.theme;
		this.paint.setColor(this.canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3]));
		this.hoveredPaint.setColor(
			this.canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3])
		);
		this.handleStrokePaint.setColor(
			this.canvasKit.Color4f(primary[0], primary[1], primary[2], primary[3])
		);
		this.triggerDraw();
	}

	public triggerDraw() {
		this.renderManager.requestRender();
	}

	public isToolActive() {
		return this.coreApi.getToolManager().getActiveToolName() === 'export';
	}

	private drawSelection() {
		const box = this.sessionManager.getActiveSession()?.getSelectedRegion();
		if (!box) return;

		this.drawSelectionOverlay({
			startX: box.startX,
			startY: box.startY,
			endX: box.startX + box.width,
			endY: box.startY + box.height
		});
	}

	private drawResizeHandles(left: number, top: number, right: number, bottom: number) {
		const handles = [
			{ x: left, y: top, position: HandlePosition.TopLeft },
			{ x: right, y: top, position: HandlePosition.TopRight },
			{ x: left, y: bottom, position: HandlePosition.BottomLeft },
			{ x: right, y: bottom, position: HandlePosition.BottomRight }
		];

		handles.forEach((handle) => {
			drawAnchor(
				this.canvasKit,
				this.skCanvas,
				handle.x,
				handle.y,
				{
					fillPaint: this.handleWhiteFillPaint,
					strokePaint: this.handleStrokePaint
				},
				this.camera.getPixelRatio()
			);
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

		this.skCanvas.save();
		this.skCanvas.translate(rectCenterX, rectCenterY);
		this.skCanvas.translate(-rectCenterX, -rectCenterY);

		const currentMode = this.modeCtx.getCurrentMode();
		let rectPaint = this.paint;

		const isSelectedAndHovering =
			currentMode.name === SelectionModeName.SELECTED &&
			(currentMode as SelectedMode).isMouseInside();
		const isMoving = currentMode.name === SelectionModeName.MOVING;

		if (isSelectedAndHovering || isMoving) rectPaint = this.hoveredPaint;
		this.skCanvas.drawRect(rect, rectPaint);

		if (
			(currentMode.name === SelectionModeName.SELECTED ||
				currentMode.name === SelectionModeName.MOVING ||
				currentMode.name === SelectionModeName.RESIZING) &&
			this.isToolActive()
		) {
			this.drawResizeHandles(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
		}

		this.skCanvas.restore();
	}

	public clear(): void {
		this.renderManager.requestRenderFn();
	}
}
