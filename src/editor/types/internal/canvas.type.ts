import type { CanvasKit, Surface, Canvas as WasmCanvas } from 'canvaskit-wasm';

export interface ICanvas {
	canvas: HTMLCanvasElement;
	canvasKit: CanvasKit;
	surface: Surface;
	skCanvas: WasmCanvas;

	render(): void;
	dispose(): void;
}
