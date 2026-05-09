import { BaseTool } from '@editor/tool';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';

import type { ITool } from '@editor/tool';
import type { ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { IdleState, type IShapeDrawToolState } from './state';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { LayerController } from '@editor/layers/layer-api';

export enum Shapes {
	rectangle,
	line,
	elbowArrow
}

export interface IShapeToolContext {
	readonly coreApi: CoreApi;
	readonly camera: ICamera;
	readonly layers: LayersManager;
	currentShape: Shapes;
	tempLayer: LayerController | null;
	tempLayerId?: string;
	previewObject: ISmartObject | null;
	drawnObject: ISmartObject | null;
	startDragPosition: { col: number; row: number } | null;
	setState(newState: IShapeDrawToolState): void;
	getCellPos(event: MouseEvent): { col: number; row: number };
}

export class DrawShapeTool extends BaseTool implements ITool, IShapeToolContext {
	readonly name = 'shape';
	readonly icon = '/icons/rectangle.svg';

	readonly camera: ICamera;
	readonly layers: LayersManager;

	tempLayer: LayerController | null = null;
	tempLayerId?: string;
	previewObject: ISmartObject | null = null;
	drawnObject: ISmartObject | null = null;
	startDragPosition: { col: number; row: number } | null = null;
	currentShape: Shapes = Shapes.rectangle;

	private currentState!: IShapeDrawToolState;

	constructor(public readonly coreApi: CoreApi) {
		super({
			hotkey: '<A-s>',
			name: 'shape',
			isVisible: true,
			coreApi,
			config: {},
			requirements: [RequireActiveLayerVisible(coreApi, 'shape')]
		});

		this.camera = this.coreApi.getCamera();
		this.layers = this.coreApi.getLayersManager();
	}

	public activate(): void {
		super.activate();
		if (this.checkRequirements()) {
			this.initializeContext();
		}
	}

	public onRequirementSuccess(): void {
		this.initializeContext();
	}

	public onRequirementFailure(): void {
		this.cleanupContext();
	}

	private initializeContext(): void {
		if (this.tempLayer) return;

		this.setState(new IdleState(this));

		const active = this.coreApi.getLayersManager().ensureLayer();
		const [tempId, tempLayer] = this.layers.addOverlayTempLayer(active.index);
		this.tempLayerId = tempId;
		this.tempLayer = tempLayer;
		this.addMouseListeners();

		const last = this.eventManager.getLastMousePosition?.();
		if (last) {
			this.currentState?.handleMouseMove(
				new MouseEvent('mousemove', { clientX: last.x, clientY: last.y })
			);
		}
	}

	public setShape(shape: Shapes): void {
		this.currentState?.exit();

		this.currentShape = shape;

		const last = this.eventManager.getLastMousePosition?.();
		if (this.currentState && last) {
			this.currentState.handleMouseMove(
				new MouseEvent('mousemove', { clientX: last.x, clientY: last.y })
			);
		}
	}

	private cleanupContext(): void {
		if (!this.tempLayer) return;

		this.getEventApi().removeToolEvents();

		this.currentState?.exit();

		if (this.tempLayerId) this.layers.removeTempLayer(this.tempLayerId);
		this.tempLayer = null;
		this.tempLayerId = undefined;
	}

	public deactivate(): void {
		super.deactivate();
		this.cleanupContext();
	}

	public setState(newState: IShapeDrawToolState): void {
		this.currentState?.exit();
		this.currentState = newState;
		this.currentState.enter();
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseDown(
			'left',
			(e) => this.currentState && this.currentState.handleMouseDown(e)
		);
		this.getEventApi().registerMouseMove(
			(e) => this.currentState && this.currentState.handleMouseMove(e)
		);
		this.getEventApi().registerMouseUp(
			(e) => this.currentState && this.currentState.handleMouseUp(e)
		);
	}

	public getCellPos(event: MouseEvent): { col: number; row: number } {
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
