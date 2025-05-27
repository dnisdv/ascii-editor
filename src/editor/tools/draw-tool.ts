import { BaseTool } from "../tool";
import type { ITool } from "../tool";
import type { ILayersManager, ICamera, IRenderManager } from "@editor/types";
import type { CanvasKit, Paragraph, ParagraphStyle, Canvas as WasmCanvas } from "canvaskit-wasm";
import type { HistoryManager } from "@editor/history-manager";
import { RequireActiveLayerVisible } from "@editor/tool-requirements";
import type { CoreApi } from "@editor/core";

export class DrawTool extends BaseTool implements ITool {
  private isDrawing: boolean = false;
  private layers: ILayersManager;
  private camera: ICamera;

  private paragraphs: Map<string, Paragraph>;
  private paraStyle: ParagraphStyle;

  private canvasKit: CanvasKit;
  private skCanvas: WasmCanvas;

  private renderManager: IRenderManager;

  private historyManager: HistoryManager;
  private historyBatchTransaction: string | null = null;
  private lastMousePos: { x: number; y: number } | null = null;

  private isLayerVisible: boolean = true;

  constructor(coreApi: CoreApi) {
    super({
      hotkey: '<A-d>',
      bus: coreApi.getBusManager(),
      name: "draw",
      isVisible: true,
      coreApi,
      config: {
        activeSymbol: 'X'
      },
      requirements: [
        RequireActiveLayerVisible(coreApi, 'draw'),
      ]
    });

    const select = coreApi.getCanvases().select;

    const { canvasKit, skCanvas } = select;
    this.canvasKit = canvasKit;
    this.skCanvas = skCanvas;

    this.camera = coreApi.getCamera();
    this.layers = coreApi.getLayersManager();

    const foreground = this.coreApi.getConfig().getTheme().primary;

    this.paraStyle = new canvasKit.ParagraphStyle({
      textStyle: {
        color: canvasKit.Color4f(foreground[0], foreground[1], foreground[2], foreground[3]),
        fontSize: 16,
      },
    });
    this.paragraphs = new Map();
    this.renderManager = select.getRenderManager();
    this.historyManager = this.coreApi.getHistoryManager();

    this.layers.on('layers::active::change', () => {
      const activeLayer = this.layers.getActiveLayer();
      this.isLayerVisible = activeLayer?.opts?.visible ?? true;
      this.updateCursorVisibility();
    });

    this.layers.on('layer::updated', ({ before, after }) => {
      const isLayerVisibilityChanged = before.opts?.visible !== after.opts?.visible;
      if (isLayerVisibilityChanged) {
        const activeLayer = this.layers.getActiveLayer();
        if (activeLayer?.id === after.id) {
          this.isLayerVisible = after.opts?.visible ?? true;
          this.updateCursorVisibility();

          if (!this.isLayerVisible && this.isDrawing) {
            this.cancelDrawing();
          }
        }
      }
    });
  }

  activate(): void {
    super.activate()
    this.addMouseListeners();

    this.renderManager.register('tool::draw', 'draw::symbol', () => {
      if (!this.lastMousePos) return;
      this.drawActiveSymbol(this.lastMousePos!.x, this.lastMousePos!.y)
    });
  }

  deactivate(): void {
    super.deactivate()
    this.getEventApi().removeToolEvents()
    this.renderManager.unregister('tool::draw', 'draw::symbol')
  }

  private cancelDrawing(): void {
    this.isDrawing = false;
    if (this.historyBatchTransaction) {
      this.historyManager.commitBatch(this.historyBatchTransaction);
      this.historyBatchTransaction = null;
    }
    this.lastMousePos = null;
    this.coreApi.render();
  }

  private updateCursorVisibility(): void {
    if (this.lastMousePos && this.isLayerVisible) {
      this.renderManager.requestRender('tool::draw', 'draw::symbol')
    }
  }

  private changeActiveKey(newKey: string) {
    this.config = { activeSymbol: newKey }
    this.saveConfig({ activeSymbol: newKey });

    if (this.lastMousePos) {
      this.renderManager.requestRender('tool::draw', 'draw::symbol')
    }
  }

  private getParagraph(text: string, width: number): Paragraph {
    const key = `${text}_${width}`;
    if (!this.paragraphs.has(key)) {

      const fontMgr = this.coreApi.getFontManager().getFontMgr()
      const builder = this.canvasKit.ParagraphBuilder.Make(this.paraStyle, fontMgr);
      builder.addText(text);
      const paragraph = builder.build();
      paragraph.layout(width);
      this.paragraphs.set(key, paragraph);
    }
    return this.paragraphs.get(key)!;
  }

  private drawActiveSymbol(sx: number, sy: number): void {
    const { x, y } = this.camera.getMousePosition({ x: sx, y: sy });
    const { dimensions: { width: charWidth } } = this.coreApi.getFontManager().getMetrics()

    const paragraph = this.getParagraph(String(this.config.activeSymbol), charWidth);
    this.skCanvas.drawParagraph(paragraph, x + 20, y + 20);
  }

  cleanup(): void { }

  private addMouseListeners(): void {
    this.getEventApi().registerMouseDown('left', this.handleCanvasMouseDown.bind(this));
    this.getEventApi().registerMouseMove(this.handleCanvasMouseMove.bind(this));
    this.getEventApi().registerMouseUp(this.handleCanvasMouseUp.bind(this));

    this.getEventApi().registerKeyPress(/^(?!Alt).*$/, this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key.length === 1) {
      this.changeActiveKey(event.key)
      this.coreApi.render();
    }
  }

  private handleCanvasMouseDown(event: MouseEvent): void {
    this.layers.ensureLayer();

    if (event.button !== 0 || !this.checkRequirements()) return;

    this.historyBatchTransaction = this.historyManager.beginBatch();
    this.isDrawing = true;
    this.handleDrawing(event);
  }

  private handleCanvasMouseMove(event: MouseEvent): void {
    this.renderManager.requestRender('tool::draw', 'draw::symbol')

    if (this.isDrawing && this.isLayerVisible) {
      this.handleDrawing(event);
    }

    this.lastMousePos = { x: event.clientX, y: event.clientY };
  }

  private handleCanvasMouseUp(): void {
    if (this.isDrawing && this.isLayerVisible) {
      this.isDrawing = false;
      if (this.historyBatchTransaction) {
        this.historyManager.commitBatch(this.historyBatchTransaction);
        this.historyBatchTransaction = null;
      }
    }
  }

  private handleDrawing(event: MouseEvent): void {
    if (!this.isLayerVisible) return;

    const { x, y } = this.getCellPos(event);
    this.drawPlaceholder(y, x);
  }

  private getCellPos(event: MouseEvent) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()
    const mousePos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
    const pos = this.camera.screenToWorld(mousePos.x, mousePos.y);
    const x = Math.floor(pos.x / charWidth);
    const y = Math.floor(pos.y / charHeight);
    return { x, y };
  }

  getConfig() {
    return this.config as { activeSymbol: string }
  }

  private drawPlaceholder(col: number, row: number): void {
    if (!this.isLayerVisible) return;

    const activeLayer = this.layers.ensureLayer();
    if (!activeLayer) return;
    const beforeChar = activeLayer.getChar(row, col);

    if (beforeChar != this.config.activeSymbol) {
      this.historyManager.applyAction({
        targetId: `layer::${activeLayer.id}`,
        type: `layer::set_chars`,
        before: { x: row, y: col, char: beforeChar },
        after: { x: row, y: col, char: this.config.activeSymbol },
      }, { batchId: String(this.historyBatchTransaction) });
    }

    activeLayer?.setChar(row, col, this.getConfig().activeSymbol);
    this.coreApi.render();
  }
}


