import type { CanvasKit, Canvas as WasmCanvas } from 'canvaskit-wasm';
import type { ICamera } from '@editor/types';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';
import type { LayersManager } from '@editor/layers/layers-manager';

export type AsciiRenderingDeps = {
	canvasKit: CanvasKit;
	skCanvas: WasmCanvas;
	camera: ICamera;
	layersManager: LayersManager;
	config: Config;
	fontManager: FontManager;
	opacity?: number;
};

export interface IAsciiRenderingStrategy {
	render(deps: AsciiRenderingDeps): void;
	dispose(): void;
}
