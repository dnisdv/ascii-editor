import { BusManager } from './bus-manager';
import type { ToolManager } from './tool-manager';
import type { HistoryManager } from './history-manager';
import type { ICamera, ICanvas, ILayersManager } from './types';
import type { Config } from './config';
import type { FontManager } from './font-manager';
import type { Cursor } from './cursor';
import type { UI } from './ui';
import type { RenderManager } from './render-manager';

export type CoreApi = {
	getCamera(): ICamera;
	getBusManager(): BusManager;

	getCanvases(): { grid: ICanvas; select: ICanvas; ascii: ICanvas };
	getLayersManager(): ILayersManager;
	getToolManager(): ToolManager;
	getHistoryManager(): HistoryManager;
	getFontManager(): FontManager;
	getRenderManager(): RenderManager;

	getConfig(): Config;
	getCursor(): Cursor;

	render(): void;
};

export interface CoreDependencies {
	// specific
	busManager: BusManager;
	config: Config;
	fontManager: FontManager;
	historyManager: HistoryManager;
	cursor: Cursor;
	toolManager: ToolManager;
	ui: UI;
	renderManager: RenderManager;

	// abstract
	camera: ICamera;
	layersManager: ILayersManager;
}

export class Core implements CoreApi {
	private toolManager: ToolManager;
	private camera: ICamera;
	private layers: ILayersManager;
	private busManager: BusManager;
	private cursor: Cursor;
	private history: HistoryManager;
	private config: Config;
	private fontManager: FontManager;
	private renderManager: RenderManager;
	private ui: UI;

	constructor({
		camera,
		busManager,
		fontManager,
		historyManager,
		config,
		layersManager,
		cursor,
		toolManager,
		ui,
		renderManager
	}: CoreDependencies) {
		this.camera = camera;
		this.busManager = busManager;
		this.fontManager = fontManager;
		this.history = historyManager;
		this.config = config;
		this.layers = layersManager;
		this.cursor = cursor;
		this.toolManager = toolManager;
		this.ui = ui;
		this.renderManager = renderManager;
	}

	getCamera(): ICamera {
		return this.camera;
	}
	getBusManager(): BusManager {
		return this.busManager;
	}
	getLayersManager(): ILayersManager {
		return this.layers;
	}
	getToolManager(): ToolManager {
		return this.toolManager;
	}
	getHistoryManager(): HistoryManager {
		return this.history;
	}
	getFontManager(): FontManager {
		return this.fontManager;
	}
	getConfig(): Config {
		return this.config;
	}
	getCursor(): Cursor {
		return this.cursor;
	}
	getUI(): UI {
		return this.ui;
	}
	getRenderManager(): RenderManager {
		return this.renderManager;
	}

	getCanvases(): { grid: ICanvas; select: ICanvas; ascii: ICanvas } {
		return {
			ascii: this.ui.getAsciiCanvas(),
			select: this.ui.getSelectCanvas(),
			grid: this.ui.getGridCanvas()
		};
	}

	render(): void {
		this.getRenderManager().requestRenderAll();
	}
}
