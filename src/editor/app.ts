import type { ITool } from './tool';
import type { DocumentSchemaType, ICamera } from './types';
import type { CanvasKit } from 'canvaskit-wasm';
import type { FontData } from './font';
import type { SmartObjectClass } from './objects/smart-object.interface';
import { UI } from './ui';
import { Core } from './core';
import { FontManager } from './font-manager';
import { HistoryManager } from './history-manager';
import { Config } from './config';
import { LayersManager } from './layers/layers-manager';
import { Cursor } from './cursor';
import { ToolManager } from './tool-manager';
import { RenderManager } from './render-manager';
import { SelectionManager } from './select/selection-manager';
import { SmartObjectsManager } from './smart-objects-manager';
import { ConfigSerializer } from './serializer/config.serializer';
import { ToolsConfigSerializer } from './serializer/tools.serializer';
import { AppSerializer, CameraSerializer, LayerSerializer, LayersSerializer } from './serializer';
import { FeedbackManager } from './feedback-manager';
import { ClipboardManager } from './clipboard/clipboard-manager';

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
	registerObject(type: string, object: SmartObjectClass) {
		this.core.getSmartObjectsManager().register(type, object);
	}
	hydratateDocument(data: DocumentSchemaType) {
		this.serializer.deserialize(data);
	}

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
	camera: ICamera;
	font: FontData;
}

export function createAppInstance(options: AppFactoryOptions): [Core, App] {
	const {
		canvasKitInstance,
		gridCanvasElement,
		selectCanvasElement,
		asciiCanvasElement,
		camera,
		font
	} = options;

	const feedbackManager = new FeedbackManager();

	const config = new Config();
	const historyManager = new HistoryManager();
	const fontManager = new FontManager(canvasKitInstance, font, { size: 18 });

	const smartObjectsManager = new SmartObjectsManager(config);

	const layerSerializer = new LayerSerializer(smartObjectsManager, config);
	const renderManager = new RenderManager();
	const layersManager = new LayersManager({
		config,
		historyManager,
		layerSerializer
	});

	layersManager.on('temp_layer::object::op', () => renderManager.requestRenderAll());
	layersManager.on('layer::object::op', () => renderManager.requestRenderAll());
	layersManager.on('temp_layer::object::update', () => renderManager.requestRenderAll());
	layersManager.on('layer::object::update', () => renderManager.requestRenderAll());
	layersManager.on('layer::object::removed', () => renderManager.requestRenderAll());
	layersManager.on('temp_layer::object::removed', () => renderManager.requestRenderAll());

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
	const selectionManager = new SelectionManager({
		layersManager,
		fontManager,
		config,
		historyManager,
		smartObjectsManager
	});

	selectionManager.on('session::changed', () => renderManager.requestRenderAll());
	selectionManager.on('session::committed', () => renderManager.requestRenderAll());
	selectionManager.on('session::cancelled', () => renderManager.requestRenderAll());
	selectionManager.on('manager::session_created', () => renderManager.requestRenderAll());
	selectionManager.on('manager::session_destroyed', () => renderManager.requestRenderAll());
	selectionManager.on('manager::session_change', () => renderManager.requestRenderAll());

	const toolManager = new ToolManager({ canvas: ui.getSelectCanvas() });

	const clipboardManager = new ClipboardManager({
		selectionManager,
		smartObjectsManager,
		layersManager,
		historyManager,
		config,
		feedbackManager
	});

	toolManager.on('tool::activated', (event) => {
		renderManager.requestRenderAll();
		if (event.name !== 'select') {
			selectionManager.commitSelection();
		}
	});

	selectionManager.on('manager::session_created', () => {
		toolManager.activateTool('select');
	});

	layersManager.on('layer::active::changed', () => selectionManager.commitSelection());
	layersManager.on('layer::removed', () => selectionManager.commitSelection());

	layersManager.on('layer::updated', () => renderManager.requestRenderAll());

	window.addEventListener('beforeunload', () => {
		selectionManager.commitSelection();
	});

	const layersSerializer = new LayersSerializer(layerSerializer, layersManager);

	const cameraSerializer = new CameraSerializer(camera);
	const configSerializer = new ConfigSerializer(config);
	const toolsConfigSerializer = new ToolsConfigSerializer(toolManager);

	const serializer = new AppSerializer({
		layerSerializer,
		layersSerializer,
		cameraSerializer,
		configSerializer,
		toolsConfigSerializer
	});

	const core = new Core({
		camera,
		fontManager,
		historyManager,
		config,
		layersManager,
		cursor,
		toolManager,
		ui,
		renderManager,
		selectionManager,
		smartObjectsManager,
		feedbackManager,
		clipboardManager,
		serializer
	});

	return [core, new App({ core, serializer })];
}
