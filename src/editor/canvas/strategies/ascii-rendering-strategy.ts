import type { CanvasKit, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { ICamera, ILayersManager } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';

export interface IAsciiRenderingStrategy {
	render(
		canvasKit: CanvasKit,
		skCanvas: WasmCanvas,
		camera: ICamera,
		layersManager: ILayersManager,
		config: Config,
		fontManager: FontManager
	): void;
	dispose(): void;
}
