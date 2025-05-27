import { Grid } from "./canvas/grid";
import { Ascii } from "./canvas/ascii";
import { Select } from "./canvas/select";
import type { CanvasKit } from "canvaskit-wasm";
import type { Config } from "./config";
import type { ICamera, ILayersManager } from "./types";
import type { FontManager } from "./font-manager";

type IUI = {
	gridCanvasElement: HTMLCanvasElement;
	selectCanvasElement: HTMLCanvasElement;
	asciiCanvasElement: HTMLCanvasElement;
	canvasKitInstance: CanvasKit;
	config: Config
	camera: ICamera;
	layersManager: ILayersManager
	fontManager: FontManager;
}

export class UI {
	private gridCanvasElement: HTMLCanvasElement;
	private selectCanvasElement: HTMLCanvasElement;
	private asciiCanvasElement: HTMLCanvasElement;

	private grid: Grid;
	private select: Select;
	private ascii: Ascii;

	private canvasKit: CanvasKit;

	private camera: ICamera;
	private config: Config
	private layersManager: ILayersManager
	private fontManager: FontManager

	constructor({
		canvasKitInstance,
		gridCanvasElement,
		selectCanvasElement,
		asciiCanvasElement,
		camera,
		config,
		layersManager,
		fontManager
	}: IUI) {
		this.gridCanvasElement = gridCanvasElement
		this.selectCanvasElement = selectCanvasElement
		this.asciiCanvasElement = asciiCanvasElement

		this.canvasKit = canvasKitInstance

		this.camera = camera;
		this.config = config;
		this.layersManager = layersManager;
		this.fontManager = fontManager

		this.grid = this.initGridCanvas(gridCanvasElement);
		this.ascii = this.initAsciiCanvas(asciiCanvasElement);
		this.select = this.initSelectCanvas(selectCanvasElement);
	}

	public render() {
		this.grid?.render();
		this.ascii?.render();
	}

	public resizeCanvases() {
		this.grid.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.gridCanvasElement)!);
		this.select.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.selectCanvasElement)!);
		this.ascii.updateSurface(this.canvasKit.MakeWebGLCanvasSurface(this.asciiCanvasElement)!);

		this.render();
	}

	public getGridCanvas() { return this.grid }
	public getAsciiCanvas() { return this.ascii }
	public getSelectCanvas() { return this.select }

	private initGridCanvas(canvas: HTMLCanvasElement) {
		const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
		if (!surface) throw new Error('Could not create canvas surface');

		return new Grid({
			canvas,
			canvasKit: this.canvasKit,
			surface,
			camera: this.camera,
			config: this.config,
			fontManager: this.fontManager,
		});
	}

	private initSelectCanvas(canvas: HTMLCanvasElement) {
		const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
		if (!surface) throw new Error('Could not create canvas surface');

		return new Select({
			canvas,
			canvasKit: this.canvasKit,
			surface,
		});

	}

	private initAsciiCanvas(canvas: HTMLCanvasElement) {
		const surface = this.canvasKit.MakeWebGLCanvasSurface(canvas)!;
		if (!surface) throw new Error('Could not create canvas surface');

		return new Ascii({
			canvas,
			canvasKit: this.canvasKit,
			surface,
			camera: this.camera,
			config: this.config,
			fontManager: this.fontManager,
			layersManager: this.layersManager
		});
	}
}
