import type { CoreApi } from "@editor/core.type";
import { BaseTool } from "@editor/tool";
import type { ITool } from "@editor/tool";
import type { ILayersManager, ICamera, IRenderManager, ILayer } from "@editor/types";
import { Shape } from "./shape";
import { Rectangle } from "./shape-rectangle";
import { RequireActiveLayerVisible } from "@editor/tool-requirements";
import type { SelectToolApi } from "../select/select-tool";

export enum Shapes {
  rectangle,
}

export class DrawShapeTool extends BaseTool implements ITool {
  readonly name = 'shape';
  readonly icon = '/icons/rectangle.svg';

  private isDrawing: boolean = false
  private layers: ILayersManager;
  private camera: ICamera;
  private renderManager: IRenderManager;
  private currentShape: Shape | null = null;
  private shapes: Map<Shapes, Shape> = new Map();

  private isLayerVisible: boolean = true;

  selectSession: {
    worldRegion: {
      startX: number,
      startY: number,
      width: number,
      height: number
    },
    data: string
  } | null = null

  tempLayer: ILayer | null = null;

  constructor(coreApi: CoreApi) {
    super({
      bus: coreApi.getBusManager(),
      hotkey: '<A-s>',
      name: 'shape',
      isVisible: true,
      coreApi,
      config: {
        shape: Shapes.rectangle,
      },
      requirements: [
        RequireActiveLayerVisible(coreApi, 'shape'),
      ]
    });

    const select = this.coreApi.getCanvases().select;
    this.camera = this.coreApi.getCamera();
    this.layers = this.coreApi.getLayersManager();
    this.renderManager = select.getRenderManager();

    const [, layer] = this.coreApi.getLayersManager().addTempLayer()

    this.layers.on('layers::active::change', () => {
      const activeLayer = this.layers.getActiveLayer();
      this.isLayerVisible = activeLayer?.opts?.visible ?? true;
    });

    this.layers.on('layer::updated', ({ before, after }) => {
      const isLayerVisibilityChanged = before.opts?.visible !== after.opts?.visible;
      if (isLayerVisibilityChanged) {
        const activeLayer = this.layers.getActiveLayer();
        if (activeLayer?.id === after.id) {
          this.isLayerVisible = after.opts?.visible ?? true;

          if (!this.isLayerVisible && this.isDrawing) {
            this.cancelDrawing();
          }
        }
      }
    });

    this.registerShape(Shapes.rectangle, new Rectangle(this.coreApi, layer, 'P'));
  }

  private cancelDrawing(): void {
    this.isDrawing = false;
    if (this.tempLayer) {
      this.tempLayer.clear();
      this.coreApi.getLayersManager().removeTempLayer(this.tempLayer.id);
      this.tempLayer = null;
    }
    this.selectSession = null;
    this.currentShape = null;
    this.coreApi.render();
  }

  private registerShape(type: Shapes, shape: Shape): void {
    this.shapes.set(type, shape);
  }

  private getShape(type: Shapes): Shape | null {
    const shape = this.shapes.get(type)
    if (!shape) return null
    return shape
  }

  activate(): void {
    super.activate()
    this.addMouseListeners();
  }

  deactivate(): void {
    super.deactivate()
    this.getEventApi().removeToolEvents();
  }

  cleanup(): void {

  }

  private addMouseListeners(): void {
    this.getEventApi().registerMouseDown('left', this.handleCanvasMouseDown.bind(this));
    this.getEventApi().registerMouseMove(this.handleCanvasMouseMove.bind(this));
    this.getEventApi().registerMouseUp(this.handleCanvasMouseUp.bind(this));
  }

  private handleCanvasMouseDown(event: MouseEvent): void {
    this.layers.ensureLayer();

    if (event.button !== 0 || !this.checkRequirements()) return;
    this.isDrawing = true;

    const { col, row } = this.getCellPos(event);

    const shapeType = this.config.shape as Shapes;
    const shape = this.getShape(shapeType);

    if (!shape) {
      console.error(`not shape ${shapeType} defined`)
    }

    this.currentShape = shape;
    this.tempLayer = this.coreApi.getLayersManager().addTempLayer()[1]

    if (this.currentShape) {
      this.currentShape.startDraw(col, row);
    }
  }

  private handleCanvasMouseMove(event: MouseEvent): void {
    if (!this.isDrawing || !this.currentShape || !this.isLayerVisible) return;
    const { col, row } = this.getCellPos(event);

    if (!this.currentShape) return;

    this.renderManager.requestRenderFn(() => {
      this.currentShape?.updateDraw(col, row);
      const { startX, startY, endX, endY } = this.currentShape!.area()

      this.selectSession = {
        worldRegion: {
          startX,
          startY,
          width: endX - startX + 1,
          height: endY - startY + 1
        },
        data: this.currentShape?.toString() || ''
      }

      this.tempLayer?.clear()
      this.tempLayer?.setToRegion(startX, startY, this.currentShape?.toString() || '')
    });
  }

  private handleCanvasMouseUp(): void {
    if (this.isDrawing && this.isLayerVisible) {
      this.isDrawing = false;
      this.currentShape?.endDraw();

      const selectTool = this.coreApi.getToolManager().getToolApi<SelectToolApi>('select')
      if (!selectTool) return;

      if (this.selectSession) {
        const select = selectTool.selectSession.createSessionBuilder().build()
        select.setSelectedContent([this.selectSession])
        this.coreApi.getToolManager().activateTool('select')
        select.activateSelecting()
      }

      this.tempLayer?.clear()
      this.coreApi.getLayersManager().removeTempLayer(this.tempLayer?.id || '')
      this.tempLayer = null;

      this.selectSession = null;
      this.currentShape = null;
      this.coreApi.render();
    }
  }

  private getCellPos(event: MouseEvent) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()
    const mousePos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
    const pos = this.camera.screenToWorld(mousePos.x, mousePos.y);
    const col = Math.floor(pos.x / charWidth);
    const row = Math.floor(pos.y / charHeight);
    return { col, row };
  }
}


