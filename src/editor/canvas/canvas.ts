import type { ICanvas } from '@editor/types';
import { createDynamicProxy } from '@editor/utils';
import type { CanvasKit, Surface, Canvas as WasmCanvas } from 'canvaskit-wasm';

export class Canvas implements ICanvas {
	private _canvas: HTMLCanvasElement;
	private _canvasKit: CanvasKit;
	private _surface: Surface;
	private _skCanvas: WasmCanvas;

	private _dynamicSkCanvas: WasmCanvas;
	private _dynamicSurface: Surface;

	constructor(canvas: HTMLCanvasElement, canvasKit: CanvasKit, surface: Surface) {
		this._canvas = canvas;
		this._canvasKit = canvasKit;
		this._surface = surface;
		this._skCanvas = surface.getCanvas();

		this._dynamicSkCanvas = createDynamicProxy(() => this._skCanvas);
		this._dynamicSurface = createDynamicProxy(() => this._surface);
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

	updateSurface(newSurface: Surface): void {
		const oldSurface = this._surface;

		this._surface = newSurface;
		this._skCanvas = newSurface.getCanvas();

		if (oldSurface && oldSurface !== newSurface && !oldSurface.isDeleted()) {
			oldSurface.delete();
		}
	}

	render() {}

	dispose(): void {
		if (this._surface && !this._surface.isDeleted()) this._surface.delete();
	}
}
