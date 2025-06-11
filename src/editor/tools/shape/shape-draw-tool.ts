import { BaseTool } from '@editor/tool';
import type { ITool } from '@editor/tool';
import type { ILayersManager, ICamera, IRenderManager, ILayer } from '@editor/types';
import { Shape } from './shape';
import { Rectangle } from './shape-rectangle';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import type { SelectToolApi } from '../select/select-tool';
import type { CoreApi } from '@editor/core';

export enum Shapes {
	rectangle
}

export class DrawShapeTool extends BaseTool implements ITool {
	readonly name = 'shape';
	readonly icon = '/icons/rectangle.svg';

	private isDrawing: boolean = false;
	private layers: ILayersManager;
	private camera: ICamera;
	private renderManager: IRenderManager;
	private currentShape: Shape | null = null;
	private shapes: Map<Shapes, Shape> = new Map();

	private isLayerVisible: boolean = true;

	selectSession: {
		worldRegion: {
			startX: number;
			startY: number;
			width: number;
			height: number;
		};
		data: string;
	} | null = null;

	tempLayer: ILayer | null = null;

	constructor(coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			hotkey: '<A-s>',
			name: 'shape',
			isVisible: true,
			coreApi,
			config: {
				shape: Shapes.rectangle
			},
			requirements: [RequireActiveLayerVisible(coreApi, 'shape')]
		});

		this.camera = this.coreApi.getCamera();
		this.layers = this.coreApi.getLayersManager();
		this.renderManager = this.coreApi.getRenderManager();

		const [, layer] = this.coreApi.getLayersManager().addTempLayer();
		this.registerShape(Shapes.rectangle, new Rectangle(this.coreApi, layer, 'P'));
	}

	public activate(): void {
		super.activate();
		this.addMouseListeners();
	}

	public deactivate(): void {
		super.deactivate();
		this.getEventApi().removeToolEvents();
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
	}

	public onRequirementSuccess(): void {
		super.onRequirementSuccess();
	}

	private registerShape(type: Shapes, shape: Shape): void {
		this.shapes.set(type, shape);
	}

	private getShape(type: Shapes): Shape | null {
		const shape = this.shapes.get(type);
		if (!shape) return null;
		return shape;
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseDown('left', (e: MouseEvent) => {
			this.handleCanvasMouseDown(e);

			this.getEventApi().registerMouseMove((e: MouseEvent) => this.handleCanvasMouseMove(e));
			this.getEventApi().registerMouseUp(() => {
				this.handleCanvasMouseUp();
				this.getEventApi().unregisterMouseMove();
				this.getEventApi().unregisterMouseUp();
			});
		});
	}

	private handleCanvasMouseDown(event: MouseEvent): void {
		this.layers.ensureLayer();

		if (event.button !== 0 || !this.checkRequirements()) return;
		this.isDrawing = true;

		const { col, row } = this.getCellPos(event);

		const shapeType = this.config.shape as Shapes;
		const shape = this.getShape(shapeType);

		if (!shape) {
			console.error(`not shape ${shapeType} defined`);
		}

		this.currentShape = shape;
		this.tempLayer = this.coreApi.getLayersManager().addTempLayer()[1];

		if (this.currentShape) {
			this.currentShape.startDraw(col, row);
		}
	}

	private handleCanvasMouseMove(event: MouseEvent): void {
		if (!this.isDrawing || !this.currentShape || !this.isLayerVisible) return;
		const { col, row } = this.getCellPos(event);

		if (!this.currentShape) return;

		this.currentShape?.updateDraw(col, row);
		const { startX, startY, endX, endY } = this.currentShape!.area();

		this.selectSession = {
			worldRegion: {
				startX,
				startY,
				width: endX - startX + 1,
				height: endY - startY + 1
			},
			data: this.currentShape?.toString() || ''
		};

		this.tempLayer?.clear();
		this.tempLayer?.setToRegion(startX, startY, this.currentShape?.toString() || '');
		this.renderManager.requestRenderOnly('canvas', 'ascii');
	}

	private handleCanvasMouseUp(): void {
		if (this.isDrawing && this.checkRequirements()) {
			this.isDrawing = false;
			this.currentShape?.endDraw();

			const selectTool = this.coreApi.getToolManager().getToolApi<SelectToolApi>('select');
			if (!selectTool) return;

			const activeLayer = this.coreApi.getLayersManager().getActiveLayer();

			if (this.selectSession && this.selectSession.data.length > 1) {
				selectTool.createSessionWithContent(
					this.selectSession.worldRegion,
					this.selectSession.data,
					activeLayer?.id || ''
				);

				this.coreApi.getToolManager().activateTool('select');
			}

			this.tempLayer?.clear();
			this.coreApi.getLayersManager().removeTempLayer(this.tempLayer?.id || '');
			this.tempLayer = null;

			this.selectSession = null;
			this.currentShape = null;
		}
	}

	private getCellPos(event: MouseEvent) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		const mousePos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const pos = this.camera.screenToWorld(mousePos.x, mousePos.y);
		const col = Math.floor(pos.x / charWidth);
		const row = Math.floor(pos.y / charHeight);
		return { col, row };
	}
}
