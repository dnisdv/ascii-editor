import type { ITool } from './tool';
import type { DocumentSchemaType, ICamera } from './types';
import { AppSerializer } from './serializer';
import { Core } from './core';
import type { BusManager } from './bus-manager';
import type { CanvasKit } from 'canvaskit-wasm';
import type { FontData } from './font';
import { FontManager } from './font-manager';
import { HistoryManager } from './history-manager';
import { Config } from './config';
import { LayersManager } from './layers/layers-manager';
import { Cursor } from './cursor';
import { ToolManager } from './tool-manager';
import { UI } from './ui';
import { RenderManager } from './render-manager';

export interface AppDependencies {
	core: Core;
	serializer: AppSerializer;
}

export class App {
	private serializer: AppSerializer;
	private core: Core;

	constructor({ core, serializer }: AppDependencies) {
		this.serializer = serializer;
		this.core = core;

		this.core.render();
	}

	render() {
		this.core.getRenderManager().requestRenderAll();
	}
	registerTool(tool: ITool) {
		this.core.getToolManager().registerTool(tool);
	}
	hydratateDocument(data: DocumentSchemaType) {
		this.serializer.deserialize(data);
	}

	// TODO: Ether expose more methods from the core or think about a better way to access the core methods
	resizeCanvases() {
		this.core.getUI().resizeCanvases();
	}
	getConfig() {
		return this.core.getConfig();
	}
	getToolManager() {
		return this.core.getToolManager();
	}
}

export interface AppFactoryOptions {
	canvasKitInstance: CanvasKit;
	gridCanvasElement: HTMLCanvasElement;
	selectCanvasElement: HTMLCanvasElement;
	asciiCanvasElement: HTMLCanvasElement;
	busManager: BusManager;
	camera: ICamera;
	font: FontData;
}

export function createAppInstance(options: AppFactoryOptions): [Core, App] {
	const {
		canvasKitInstance,
		gridCanvasElement,
		selectCanvasElement,
		asciiCanvasElement,
		busManager,
		camera,
		font
	} = options;

	const config = new Config();
	const historyManager = new HistoryManager();
	const fontManager = new FontManager(canvasKitInstance, font, { size: 18 });
	const layersManager = new LayersManager({ layersBus: busManager.layers, config, historyManager });
	const renderManager = new RenderManager();

	layersManager.on('layer::update::model', () => renderManager.requestRenderAll());
	layersManager.on('layer::remove::after', () => renderManager.requestRenderAll());

	const ui = new UI({
		canvasKitInstance,
		gridCanvasElement,
		selectCanvasElement,
		asciiCanvasElement,
		renderManager: renderManager,

		config,
		camera,
		layersManager,
		fontManager
	});

	const cursor = new Cursor({ canvas: ui.getSelectCanvas() });
	const toolManager = new ToolManager({ toolBus: busManager.tools, canvas: ui.getSelectCanvas() });

	toolManager.on('tool::activate', () => {
		cursor.setCursor('default')
		core.render()
	});

	const core = new Core({
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
	});

	const serializer = new AppSerializer(core);
	return [core, new App({ core, serializer })];
}
