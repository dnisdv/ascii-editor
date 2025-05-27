import { BaseTool } from "../tool";
import type { ITool } from "../tool";
import type { ILayersManager, ICamera, IRenderManager, ILayer } from "@editor/types";
import type {
  CanvasKit,
  Paint,
  Canvas as WasmCanvas,
} from "canvaskit-wasm";
import type { ActionHandler, BaseAction, HistoryManager } from "@editor/history-manager";
import { RequireActiveLayerVisible } from "@editor/tool-requirements";
import type { CoreApi } from "@editor/core";

export class TextTool extends BaseTool implements ITool {
  readonly name = "text";
  readonly icon = "/icons/text.svg";

  private layers: ILayersManager;
  private camera: ICamera;

  private canvasKit: CanvasKit;
  private skCanvas: WasmCanvas;

  private renderManager: IRenderManager;
  private historyManager: HistoryManager;

  private selectedCell: { x: number; y: number } | null = null;
  private isActive: boolean = false;

  private paint: Paint;

  private isLayerVisible: boolean = true;

  private editSession: {
    region: {
      startX: number,
      startY: number,
      endX: number,
      endY: number
    }
    content: Map<string, string>
  } | null = null;

  private tempLayer: ILayer | null = null;

  constructor(coreApi: CoreApi) {
    super({
      hotkey: "<A-t>",
      bus: coreApi.getBusManager(),
      name: "text",
      isVisible: true,
      config: {},
      coreApi,
      requirements: [
        RequireActiveLayerVisible(coreApi, 'text'),
      ]
    });

    const select = coreApi.getCanvases().select;

    const { canvasKit, skCanvas } = select;
    this.canvasKit = canvasKit;
    this.skCanvas = skCanvas;

    this.camera = coreApi.getCamera();
    this.layers = coreApi.getLayersManager();

    this.renderManager = select.getRenderManager();
    this.historyManager = this.coreApi.getHistoryManager();

    const { primary } = this.coreApi.getConfig().getTheme();

    this.paint = new this.canvasKit.Paint();
    this.paint.setColor(this.canvasKit.Color4f(primary[0], primary[1], primary[2], 0.5));
    this.paint.setStyle(this.canvasKit.PaintStyle.Fill);
    this.paint.setAntiAlias(true);

    this.historyManager.registerHandler('tool::text::region', new TextWriteAction())

    this.camera.on('change', () => {
      this.drawSelectedOverlay()
    })

    this.historyManager.onBeforeUndo(() => {
      if (this.isActive && this.editSession && this.editSession.content.size > 0) {
        this.commitEditSession()
      }
    });

    this.layers.on('layer::pre-remove', () => this.commitEditSession());

    this.layers.on('layers::active::change', () => {
      const activeLayer = this.layers.getActiveLayer();
      this.isLayerVisible = activeLayer?.opts?.visible ?? true;
      this.handleVisibilityChange();
    });

    this.layers.on('layer::updated', ({ before, after }) => {
      const isLayerVisibilityChanged = before.opts?.visible !== after.opts?.visible;
      if (isLayerVisibilityChanged) {
        const activeLayer = this.layers.getActiveLayer();
        if (activeLayer?.id === after.id) {
          this.isLayerVisible = after.opts?.visible ?? true;
          this.handleVisibilityChange();
        }
      }
    });
  }

  private handleVisibilityChange(): void {
    if (this.editSession) {
      this.commitEditSession();
    }
    this.nullSelectedCell();
    this.drawSelectedOverlay();
  }

  activate(): void {
    super.activate()
    this.isActive = true;
    this.addMouseListeners();

    this.renderManager.register('tool::text', 'selectedOverlay', () => {
      const selectedCell = this.getSelectedCell();
      if (!selectedCell) return;

      const { x, y } = selectedCell;
      const { startX, startY, endX, endY } = this.cellPositionToMouse(x, y);

      const rect = this.canvasKit.LTRBRect(startX, startY, endX, endY);
      this.skCanvas.drawRect(rect, this.paint);
    });
  }

  deactivate(): void {
    super.deactivate()
    this.getEventApi().removeToolEvents();

    this.isActive = false;
    this.commitEditSession()
    this.renderManager.unregister('tool::text', 'selectedOverlay')
  }

  private addMouseListeners(): void {
    this.getEventApi().registerMouseDown('left', this.handleCanvasMouseDown.bind(this));
    this.getEventApi().registerMouseMove(this.handleCanvasMouseUp.bind(this));

    this.getEventApi().registerKeyPress('<C-v>', this.handlePaste.bind(this));
    this.getEventApi().registerKeyPress(/^<[CSM]?-?(?:[a-zA-Z0-9 ]|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Backspace|.)>$/, this.handleKeyPress.bind(this));
  }

  private handleCanvasMouseDown(event: MouseEvent): void {
    this.layers.ensureLayer();

    if (
      event.button !== 0 || !this.checkRequirements()
    ) return;

    const { x, y } = this.getCellPos(event);
    this.startEditSession(x, y);
    this.setSelectedCell(x, y);
  }

  private startEditSession(x: number, y: number): void {
    const activeLayer = this.layers.ensureLayer();

    this.commitEditSession();
    this.tempLayer = this.layers.addTempLayer()[1];

    const initialState = new Map<string, string>();
    initialState.set(`${x},${y}`, activeLayer.getChar(x, y) || ' ');

    this.editSession = {
      region: {
        startX: x,
        endX: x,
        startY: y,
        endY: y
      },
      content: new Map(),
    };
  }

  private commitEditSession(): void {
    const activeLayer = this.layers.getActiveLayer();
    if (!activeLayer || !this.tempLayer || !this.editSession) return;

    if (
      this.editSession.region.startX === this.editSession.region.endX &&
      this.editSession.region.startY === this.editSession.region.endY
    ) {
      this.tempLayer?.clear();
      this.layers.removeTempLayer(this.tempLayer.id);
      this.editSession = null;
      this.tempLayer = null;
      this.nullSelectedCell();
      this.coreApi.render();
      return;
    }

    const minX = Math.min(this.editSession.region.startX, this.editSession.region.endX);
    const maxX = Math.max(this.editSession.region.startX, this.editSession.region.endX);
    const minY = Math.min(this.editSession.region.startY, this.editSession.region.endY);
    const maxY = Math.max(this.editSession.region.startY, this.editSession.region.endY);

    const rows: string[] = [];
    for (let y = minY; y <= maxY; y++) {
      const row: string[] = [];
      for (let x = minX; x <= maxX; x++) {
        const cellKey = `${x},${y}`;
        const char = this.editSession.content.get(cellKey) || ' ';
        row.push(char);
      }
      rows.push(row.join(''));
    }

    const contentString = rows.join('\n');
    const beforeRegion = activeLayer.readRegion(minX, minY, maxX - minX + 1, maxY - minY + 1);

    this.historyManager.applyAction({
      type: 'tool::text::region',
      targetId: `layer::${activeLayer.id}`,
      before: {
        region: { startX: minX, startY: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        data: beforeRegion
      },
      after: {
        region: { startX: minX, startY: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        data: contentString
      }
    });

    this.tempLayer.clear();
    this.layers.removeTempLayer(this.tempLayer.id);

    this.editSession = null;
    this.tempLayer = null;

    this.nullSelectedCell();
    this.coreApi.render();
  }

  private handleCanvasMouseUp(): void {
  }

  private handleKeyPress(event: KeyboardEvent): void {
    if (!this.isActive || !this.getSelectedCell() || !this.isLayerVisible) return;

    if (event.key.length === 1) {
      this.handleTypeCharacter(event.key);
      return;
    }

    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        this.handleBackspace();
        break;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        this.handleArrowKeys(event.key);
        break;
      default:
    }
  }

  private handleTypeCharacter(char: string): void {
    if (!this.tempLayer || !this.selectedCell || !this.editSession) return;

    const { x, y } = this.selectedCell;

    this.tempLayer.setChar(x, y, char);
    this.editSession.content.set(`${x},${y}`, char);
    this.validateAndUpdateRegion(x, y);

    this.setSelectedCell(x + 1, y);
    this.coreApi.render();
  }


  private handleBackspace(): void {
    if (!this.tempLayer || !this.selectedCell || !this.editSession) return;

    const { x, y } = this.selectedCell;
    let newX = x;
    let newY = y;

    if (x > 0) {
      newX = x - 1;
    } else if (y > 0) {
      newY = y - 1;
      newX = this.editSession.region.endX;
    }

    const cellKey = `${newX},${newY}`;
    this.tempLayer.setChar(newX, newY, ' ');
    this.editSession.content.set(cellKey, ' ');

    this.setSelectedCell(newX, newY);
    this.coreApi.render();
  }

  private handlePaste(): void | false {
    if (!this.tempLayer || !this.selectedCell || !this.editSession) return;

    try {
      navigator.clipboard.readText().then((clipboardText) => {
        if (!clipboardText || !this.selectedCell || !this.editSession || !this.tempLayer) return;

        const { x: startX, y: startY } = this.selectedCell;
        const lines = clipboardText.split(/\r?\n/);
        let maxLineLength = 0;
        let newX = startX;
        let newY = startY;

        lines.forEach((line, lineIndex) => {
          const currentY = startY + lineIndex;
          const lineLength = line.length;
          maxLineLength = Math.max(maxLineLength, lineLength);

          for (let i = 0; i < line.length; i++) {
            const currentX = startX + i;
            const char = line[i];
            this.tempLayer!.setChar(currentX, currentY, char);
            this.editSession!.content.set(`${currentX},${currentY}`, char);
          }

          if (lineIndex === lines.length - 1) {
            newX = startX + line.length;
            newY = currentY;
          }
        });

        this.editSession!.region.startX = Math.min(this.editSession!.region.startX, startX);
        this.editSession!.region.endX = Math.max(this.editSession!.region.endX, startX + maxLineLength - 1);
        this.editSession!.region.startY = Math.min(this.editSession!.region.startY, startY);
        this.editSession!.region.endY = Math.max(this.editSession!.region.endY, startY + lines.length - 1);

        this.setSelectedCell(newX, newY);
        this.coreApi.render();
      });
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }

    return false;
  }



  private validateAndUpdateRegion(x: number, y: number): void {
    if (!this.editSession) return;

    this.editSession.region.startX = Math.min(this.editSession.region.startX, x);
    this.editSession.region.endX = Math.max(this.editSession.region.endX, x);
    this.editSession.region.startY = Math.min(this.editSession.region.startY, y);
    this.editSession.region.endY = Math.max(this.editSession.region.endY, y);
  }

  private handleArrowKeys(key: string): void {
    if (!this.selectedCell || !this.editSession) return;

    const { x, y } = this.selectedCell;
    let newX = x, newY = y;

    switch (key) {
      case 'ArrowUp': newY--; break;
      case 'ArrowDown': newY++; break;
      case 'ArrowLeft': newX--; break;
      case 'ArrowRight': newX++; break;
    }

    this.validateAndUpdateRegion(newX, newY);
    this.setSelectedCell(newX, newY);
    this.coreApi.render();
  }


  private nullSelectedCell() {
    this.selectedCell = null;
    this.drawSelectedOverlay();
  }

  private setSelectedCell(x: number, y: number) {
    if (!this.editSession) {
      throw new Error("Cannot set selected cell without an active edit session");
    }

    this.selectedCell = { x, y };
    this.validateAndUpdateRegion(x, y);
    this.drawSelectedOverlay();
  }


  private getSelectedCell() {
    return this.selectedCell
      ? { x: this.selectedCell.x, y: this.selectedCell.y }
      : null;
  }

  private drawSelectedOverlay() {
    this.renderManager.requestRender('tool::text', 'selectedOverlay');
  }

  private cellPositionToMouse(cellX: number, cellY: number) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()
    const startWorldX = cellX * charWidth;
    const startWorldY = cellY * charHeight;
    const endWorldX = startWorldX + charWidth;
    const endWorldY = startWorldY + charHeight;

    const screenStart = this.camera.worldToScreen(startWorldX, startWorldY);
    const screenEnd = this.camera.worldToScreen(endWorldX, endWorldY);

    return {
      startX: screenStart.x,
      startY: screenStart.y,
      endX: screenEnd.x,
      endY: screenEnd.y,
    };
  }

  private getCellPos(event: MouseEvent) {
    const { dimensions: { width: charWidth, height: charHeight } } = this.coreApi.getFontManager().getMetrics()

    const mousePos = this.camera.getMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
    const worldPos = this.camera.screenToWorld(mousePos.x, mousePos.y);
    const x = Math.floor(worldPos.x / charWidth);
    const y = Math.floor(worldPos.y / charHeight);
    return { x, y };
  }
}

type TextRegion = {
  region: {
    startX: number,
    startY: number,
    width: number,
    height: number
  }
  data: string
}

export interface TextWriteRegionAction extends BaseAction {
  type: 'tool::text::region';
  before: TextRegion;
  after: TextRegion;
}

export class TextWriteAction implements ActionHandler<TextWriteRegionAction> {
  apply(action: TextWriteRegionAction, target: ILayer): void {
    const { region: afterRegion, data: afterData } = action.after
    target.setToRegion(afterRegion.startX, afterRegion.startY, afterData, { skipSpaces: true })
  }

  revert(action: TextWriteRegionAction, target: ILayer): void {
    const { region: afterRegion } = action.after
    const { region: beforeRegion, data: beforeData } = action.before

    target.clearRegion(afterRegion.startX, afterRegion.startY, afterRegion.width, afterRegion.height)
    target.setToRegion(beforeRegion.startX, beforeRegion.startY, beforeData, { skipSpaces: true })
  }
}

