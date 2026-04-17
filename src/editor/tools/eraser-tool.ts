import { BaseTool } from '../tool';
import type { ITool } from '../tool';
import type { ICamera, IRenderManager, ICanvas } from '@editor/types';
import type { CanvasKit, Paint, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { HistoryManager } from '@editor/history-manager';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import type { CoreApi } from '@editor/core';
import type { LayersManager } from '@editor/layers/layers-manager';
import { createColor } from '@editor/utils/rendering';

export class EraserTool extends BaseTool implements ITool {
	private isDrawing: boolean = false;
	private layers: LayersManager;
	private camera: ICamera;

	private canvasKit: CanvasKit;
	private skCanvas: WasmCanvas;
	private cursorPaint: Paint;

	private renderManager: IRenderManager;

	private historyManager: HistoryManager;
	private historyBatchTransaction: string | null = null;
	private lastMousePos: { x: number; y: number } | null = null;

	private isLayerVisible: boolean = true;
	private selectCanvas: ICanvas;
	private lastCellPos: { x: number; y: number } | null = null;

	private isResizing: boolean = false;
	private resizeAccumulator: number = 0;
	private static readonly RESIZE_THRESHOLD = 30;

	constructor(coreApi: CoreApi) {
		super({
			hotkey: '<A-x>',
			name: 'eraser',
			isVisible: true,
			coreApi,
			config: { radius: 1 },
			requirements: [RequireActiveLayerVisible(coreApi, 'eraser')]
		});

		const select = coreApi.getCanvases().select;

		const { canvasKit, skCanvas } = select;
		this.canvasKit = canvasKit;
		this.skCanvas = skCanvas;

		this.selectCanvas = coreApi.getCanvases().select;
		this.camera = coreApi.getCamera();
		this.layers = coreApi.getLayersManager();

		const primary = this.coreApi.getConfig().getTheme().primary;
		this.cursorPaint = new canvasKit.Paint();
		this.cursorPaint.setColor(createColor(canvasKit, primary));
		this.cursorPaint.setStyle(canvasKit.PaintStyle.Stroke);
		this.cursorPaint.setStrokeWidth(1);
		this.cursorPaint.setAntiAlias(true);

		this.renderManager = this.coreApi.getRenderManager();
		this.historyManager = this.coreApi.getHistoryManager();
	}

	public activate(): void {
		super.activate();
		this.addMouseListeners();
		this.renderManager.register(
			'tool::eraser',
			'eraser::cursor',
			() => {
				if (!this.lastMousePos) return;
				this.drawCursor(this.lastMousePos.x, this.lastMousePos.y);
			},
			this.selectCanvas
		);
	}

	public deactivate(): void {
		super.deactivate();
		this.renderManager.unregister('tool::eraser', 'eraser::cursor');
		this.renderManager.requestRenderFn();
		this.getEventApi().removeToolEvents();
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
	}

	public onRequirementSuccess(): void {
		super.onRequirementSuccess();
	}

	private getEraserSpan(): { cols: number; rows: number } {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const radius = this.getConfig().radius;
		const rows = radius;
		const cols = Math.max(1, Math.round((radius * charHeight) / charWidth));
		return { cols, rows };
	}

	private drawCursor(sx: number, sy: number): void {
		const { x, y } = this.camera.getMousePosition({ x: sx, y: sy });
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		const worldPos = this.camera.screenToWorld(x, y);
		const cellX = Math.floor(worldPos.x / charWidth);
		const cellY = Math.floor(worldPos.y / charHeight);

		const { cols, rows } = this.getEraserSpan();
		const startCellX = cellX - Math.floor(cols / 2);
		const startCellY = cellY - Math.floor(rows / 2);

		const worldLeft = startCellX * charWidth;
		const worldTop = startCellY * charHeight;
		const worldRight = (startCellX + cols) * charWidth;
		const worldBottom = (startCellY + rows) * charHeight;

		const screenStart = this.camera.worldToScreen(worldLeft, worldTop);
		const screenEnd = this.camera.worldToScreen(worldRight, worldBottom);

		const rect = this.canvasKit.LTRBRect(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
		this.skCanvas.drawRect(rect, this.cursorPaint);
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseMove((e) => this.handleCanvasMouseMove(e));
		this.getEventApi().registerMouseDown('left', this.handleCanvasMouseDown.bind(this));
		this.getEventApi().registerMouseDown('right', this.handleRightMouseDown.bind(this));
		this.getEventApi().registerMouseUp(this.handleCanvasMouseUp.bind(this));
	}

	private handleRightMouseDown(event: MouseEvent): void {
		if (event.altKey || event.ctrlKey) {
			event.preventDefault();
			this.isResizing = true;
			this.resizeAccumulator = 0;
			this.selectCanvas.canvas.requestPointerLock();
		}
	}

	private handleCanvasMouseDown(event: MouseEvent): void {
		this.layers.ensureLayer();
		if (event.button !== 0 || !this.checkRequirements()) return;

		this.historyBatchTransaction = this.historyManager.beginBatch();
		this.isDrawing = true;
		this.lastCellPos = null;
		this.handleErasing(event);
	}

	private handleCanvasMouseMove(event: MouseEvent): void {
		if (this.isResizing) {
			this.resizeAccumulator += event.movementX;
			const steps = Math.trunc(this.resizeAccumulator / EraserTool.RESIZE_THRESHOLD);

			if (steps !== 0) {
				const currentRadius = this.getConfig().radius;
				const newRadius = Math.max(1, Math.min(15, currentRadius + steps));
				if (newRadius !== currentRadius) {
					this.saveConfig({ radius: newRadius });
				}
				this.resizeAccumulator -= steps * EraserTool.RESIZE_THRESHOLD;
			}
			this.renderManager.requestRender();
			return;
		}

		this.renderManager.requestRender();
		if (this.isDrawing && this.isLayerVisible) this.handleErasing(event);
		this.lastMousePos = { x: event.clientX, y: event.clientY };
	}

	private handleCanvasMouseUp(): void {
		if (this.isResizing) {
			this.isResizing = false;
			document.exitPointerLock();
			return;
		}

		if (this.isDrawing && this.isLayerVisible) {
			this.isDrawing = false;
			this.lastCellPos = null;
			if (this.historyBatchTransaction) {
				this.historyManager.commitBatch(this.historyBatchTransaction);
				this.historyBatchTransaction = null;
			}
		}
	}

	private handleErasing(event: MouseEvent): void {
		if (!this.isLayerVisible) return;

		const { x, y } = this.getCellPos(event);

		if (this.lastCellPos) {
			const points = this.bresenhamLine(this.lastCellPos.x, this.lastCellPos.y, x, y);
			for (const p of points) {
				this.eraseAtRadius(p.x, p.y);
			}
		} else {
			this.eraseAtRadius(x, y);
		}

		this.lastCellPos = { x, y };
	}

	private eraseAtRadius(centerX: number, centerY: number): void {
		const { cols, rows } = this.getEraserSpan();
		const halfCols = Math.floor(cols / 2);
		const halfRows = Math.floor(rows / 2);

		for (let dy = 0; dy < rows; dy++) {
			for (let dx = 0; dx < cols; dx++) {
				const cellX = centerX - halfCols + dx;
				const cellY = centerY - halfRows + dy;
				this.eraseCell(cellY, cellX);
			}
		}
	}

	private bresenhamLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
		const points: { x: number; y: number }[] = [];
		const dx = Math.abs(x1 - x0);
		const dy = Math.abs(y1 - y0);
		const sx = x0 < x1 ? 1 : -1;
		const sy = y0 < y1 ? 1 : -1;
		let err = dx - dy;

		while (true) {
			points.push({ x: x0, y: y0 });
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 > -dy) { err -= dy; x0 += sx; }
			if (e2 < dx) { err += dx; y0 += sy; }
		}
		return points;
	}

	private getCellPos(event: MouseEvent) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const mousePos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const pos = this.camera.screenToWorld(mousePos.x, mousePos.y);
		const x = Math.floor(pos.x / charWidth);
		const y = Math.floor(pos.y / charHeight);
		return { x, y };
	}

	public getConfig() {
		return this.config as { radius: number };
	}

	public update() {
		this.renderManager.requestRender();
	}

	private eraseCell(col: number, row: number): void {
		if (!this.isLayerVisible) return;

		const activeLayer = this.layers.ensureLayer();
		if (!activeLayer) return;
		const beforeChar = activeLayer.grid.getChar(row, col);

		if (beforeChar && beforeChar.trim()) {
			this.historyManager.applyAction(
				{
					targetId: `layer::${activeLayer.id}`,
					type: `layer::set_chars`,
					before: { x: row, y: col, char: beforeChar },
					after: { x: row, y: col, char: '' }
				},
				{ batchId: String(this.historyBatchTransaction) }
			);

			activeLayer.grid.setChar(row, col, '');
			this.renderManager.requestRender();
		}
	}
}
