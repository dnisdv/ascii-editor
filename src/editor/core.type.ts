import type { BusManager } from "./bus-manager";
import type { ToolManager } from "./tool-manager";
import type { HistoryManager } from "./history-manager";
import type { ICamera, ICanvas, ILayersManager } from "./types";
import type { Config } from "./config";
import type { FontManager } from "./font-manager";
import type { Cursor } from "./cursor";


export type CoreApi = {
  getCamera(): ICamera;
  getBusManager(): BusManager;

  getCanvases(): { grid: ICanvas, select: ICanvas, ascii: ICanvas };
  getLayersManager(): ILayersManager;
  getToolManager(): ToolManager;
  getHistoryManager(): HistoryManager
  getFontManager(): FontManager

  getConfig(): Config
  getCursor(): Cursor

  render(): void;
};

