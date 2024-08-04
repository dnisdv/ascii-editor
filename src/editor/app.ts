import type { CanvasKit } from "canvaskit-wasm";
import { Grid } from "./canvas/grid";
import { Camera } from "./camera";
import { Select } from "./canvas/select";
import { Ascii } from "./canvas/ascii";
import type { ITool } from "./tool";
import { ToolManager } from "./tool-manager";
import type { BusManager } from "./bus-manager";
import { Cursor } from "./cursor";
import type { CoreApi } from "./core.type";
import type { DocumentSchemaType, ICamera } from "./types";
import type { ILayersManager } from "./types";
import { HistoryManager } from "./history-manager";
import { LayersManager } from "./layers/layers-manager";
import { AppSerializer } from "./serializer";
import { Config } from "./config";
import type { FontData } from "./font";
import { FontManager } from "./font-manager";

type IApp = {
  canvasKit: CanvasKit;
  camera: Camera;
  busManager: BusManager;

  gridCanvas: HTMLCanvasElement;
  selectCanvas: HTMLCanvasElement;
  asciiCanvas: HTMLCanvasElement;

  font: FontData
}

export class App implements CoreApi {
  private toolManager: ToolManager;
  private canvasKit: CanvasKit;

  private camera: ICamera;
  private layers: ILayersManager;
  private busManager: BusManager

  private grid: Grid;
  private select: Select;
  private ascii: Ascii;
  private cursor: Cursor;
  private history: HistoryManager

  private serializer: AppSerializer
  private config: Config

  private fontManager: FontManager

  gridCanvas: HTMLCanvasElement;
  selectCanvas: HTMLCanvasElement;
  asciiCanvas: HTMLCanvasElement;

  constructor({ canvasKit, camera, busManager, gridCanvas, selectCanvas, asciiCanvas, font }: IApp) {
    this.camera = camera;
    this.config = new Config();

    this.fontManager = new FontManager(canvasKit, font, {
      size: 18
    });

    this.gridCanvas = gridCanvas
    this.selectCanvas = selectCanvas
    this.asciiCanvas = asciiCanvas

    this.busManager = busManager;
    this.canvasKit = canvasKit;
    this.history = new HistoryManager(this)
    this.layers = new LayersManager(this);

    this.grid = this.initGridCanvas(gridCanvas);
    this.ascii = this.initAsciiCanvas(asciiCanvas);
    this.select = this.initSelectCanvas(selectCanvas);

    this.cursor = new Cursor(this);
    this.toolManager = new ToolManager(this);
    this.serializer = new AppSerializer(this)

    this.render()
  }

  registerTool(tool: ITool) {
    this.toolManager?.registerTool(tool);
  }

  getFontManager(): FontManager {
    return this.fontManager
  }

  getCamera(): ICamera {
    return this.camera;
  }

  getBusManager(): BusManager {
    return this.busManager;
  }

  getCursor(): Cursor {
    return this.cursor;
  }

  getHistoryManager(): HistoryManager {
    return this.history;
  }

  getConfig(): Config {
    return this.config
  }

  getCanvases() {
    return { grid: this.grid, select: this.select, ascii: this.ascii };
  }

  getLayersManager(): ILayersManager {
    return this.layers;
  }

  getToolManager(): ToolManager {
    return this.toolManager;
  }

  render() {
    this.grid?.render();
    this.ascii?.render();
  }

  hydratateDocument(data: DocumentSchemaType) {
    this.serializer.deserialize(data)
  }

  resizeCanvases() {
    this.grid.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.gridCanvas)!);
    this.select.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.selectCanvas)!);
    this.ascii.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.asciiCanvas)!);

    this.render();
  }

  private initGridCanvas(canvas: HTMLCanvasElement) {
    const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
    if (!surface) throw new Error('Could not create canvas surface');

    return new Grid(canvas, this.canvasKit, surface, this);
  }

  private initSelectCanvas(canvas: HTMLCanvasElement) {
    const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
    if (!surface) throw new Error('Could not create canvas surface');

    this.select = new Select(canvas, this.canvasKit, surface, this);

    return this.select;
  }

  private initAsciiCanvas(canvas: HTMLCanvasElement) {
    const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
    if (!surface) throw new Error('Could not create canvas surface');

    return new Ascii(canvas, this.canvasKit, surface, this);
  }
}

