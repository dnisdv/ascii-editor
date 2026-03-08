import type { CanvasKit, Surface } from 'canvaskit-wasm';
import { Canvas } from './canvas';
import type { ICamera } from '@editor/types';
import type { LayersManager } from '@editor/layers/layers-manager';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';
import type { IAsciiRenderingStrategy } from './strategies/ascii-rendering-strategy';

export type AsciiOptions = {
	canvas: HTMLCanvasElement;
	canvasKit: CanvasKit;
	surface: Surface;
	camera: ICamera;
	config: Config;
	fontManager: FontManager;
	layersManager: LayersManager;
	renderStrategy: IAsciiRenderingStrategy;
};

export class Ascii extends Canvas {
	private camera: ICamera;
	private config: Config;
	private fontManager: FontManager;
	private layersManager: LayersManager;
	private renderingStrategy: IAsciiRenderingStrategy;

	constructor({
		canvas,
		canvasKit,
		surface,
		camera,
		config,
		layersManager,
		fontManager,
		renderStrategy
	}: AsciiOptions) {
		super(canvas, canvasKit, surface);

		this.camera = camera;
		this.config = config;
		this.layersManager = layersManager;
		this.fontManager = fontManager;
		this.renderingStrategy = renderStrategy;
	}
	public prepareForConfigChange(): void {}

	public setRenderingStrategy(strategy: IAsciiRenderingStrategy): void {
		if (this.renderingStrategy) {
			this.renderingStrategy.dispose();
		}
		this.renderingStrategy = strategy;
	}

	public render() {
		this.skCanvas.clear(this.canvasKit.TRANSPARENT);

		this.skCanvas.save();
		this.skCanvas.scale(this.camera.scale, this.camera.scale);
		this.skCanvas.translate(-this.camera.offsetX, -this.camera.offsetY);

		this.renderingStrategy.render({
			canvasKit: this.canvasKit,
			skCanvas: this.skCanvas,
			camera: this.camera,
			layersManager: this.layersManager,
			config: this.config,
			fontManager: this.fontManager
		});

		this.skCanvas.restore();
		this.surface.flush();
	}
}
