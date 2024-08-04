import type { CanvasKit, Surface } from "canvaskit-wasm";
import { Canvas } from "./canvas";
import type { CoreApi } from "@editor/core.type";

export class Select extends Canvas {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(canvas: HTMLCanvasElement, canvasKit: CanvasKit, surface: Surface, _coreApi: CoreApi) {
    super(canvas, canvasKit, surface);
  }
  render() {
    this.getRenderManager().requestRenderAll()
  }
}

