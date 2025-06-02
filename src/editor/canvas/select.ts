import type { CanvasKit, Surface } from 'canvaskit-wasm';
import { Canvas } from './canvas';

export type SelectOptions = {
	canvas: HTMLCanvasElement;
	canvasKit: CanvasKit;
	surface: Surface;
};

export class Select extends Canvas {
	constructor({ canvas, canvasKit, surface }: SelectOptions) {
		super(canvas, canvasKit, surface);
	}
	render() {}
	dispose(): void {
		super.dispose();
	}
}
