import type { CanvasKit, Surface, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { IRenderManager } from "./render-manager.type"

export interface ICanvas {
  canvas: HTMLCanvasElement
  canvasKit: CanvasKit;
  surface: Surface;
  skCanvas: WasmCanvas;

  render(): void;
  getRenderManager(): IRenderManager
}

