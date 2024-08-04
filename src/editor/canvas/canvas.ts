import { RenderManager, RenderManagerProxy } from '@editor/render-manager';
import type { ICanvas } from '@editor/types';
import type { CanvasKit, Surface, Canvas as WasmCanvas } from 'canvaskit-wasm';

function createDynamicProxy<T extends object>(getCurrent: () => T): T {
  const dummyTarget = {} as T;
  return new Proxy(dummyTarget, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(_: T, prop: PropertyKey, receiver: any): any {
      const current = getCurrent();
      const value = Reflect.get(current, prop, receiver);
      if (typeof value === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => Reflect.apply(value, getCurrent(), args);
      }
      return value;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set(_: T, prop: PropertyKey, newValue: any, receiver: any): boolean {
      const current = getCurrent();
      return Reflect.set(current, prop, newValue, receiver);
    },
  });
}

export class Canvas implements ICanvas {
  private _canvas: HTMLCanvasElement;
  private _canvasKit: CanvasKit;
  private _surface: Surface;
  private _skCanvas: WasmCanvas;

  private renderManager: RenderManager;
  private renderManagerProxy: RenderManagerProxy;

  private _dynamicSkCanvas: WasmCanvas;
  private _dynamicSurface: Surface;

  constructor(canvas: HTMLCanvasElement, canvasKit: CanvasKit, surface: Surface) {
    this._canvas = canvas;
    this._canvasKit = canvasKit;
    this._surface = surface;
    this._skCanvas = surface.getCanvas();

    this._dynamicSkCanvas = createDynamicProxy(() => this._skCanvas);
    this._dynamicSurface = createDynamicProxy(() => this._surface);

    this.renderManager = new RenderManager(canvasKit, surface);
    this.renderManagerProxy = new RenderManagerProxy(() => this.renderManager);
  }

  get skCanvas(): WasmCanvas {
    return this._dynamicSkCanvas;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get canvasKit(): CanvasKit {
    return this._canvasKit;
  }

  get surface(): Surface {
    return this._dynamicSurface;
  }

  getRenderManager() {
    return this.renderManagerProxy;
  }

  updateSurface(newSurface: Surface) {
    const oldSurface = this._surface;

    this._surface = newSurface;
    this._skCanvas = newSurface.getCanvas();
    this.renderManager.updateSurface(newSurface);
    oldSurface.delete();
  }

  render() {
  }
}
