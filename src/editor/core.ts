import type { ToolManager } from './tool-manager';
import type { HistoryManager } from './history-manager';
import type { AppSerializer, ICamera, ICanvas } from './types';
import type { Config } from './config';
import type { FontManager } from './font-manager';
import type { Cursor } from './cursor';
import type { UI } from './ui';
import type { RenderManager } from './render-manager';
import type { SelectionManager } from './select/selection-manager';
import type { SmartObjectsManager } from './smart-objects-manager';
import type { FeedbackManager } from './feedback-manager';
import type { ClipboardManager } from './clipboard/clipboard-manager';
import type { LayersManager } from './layers/layers-manager';
import { CommandRegistry, EditorCommands } from './commands/command-registry';

export type CoreApi = {
	getCamera(): ICamera;

	getCanvases(): { grid: ICanvas; select: ICanvas; ascii: ICanvas };
	getLayersManager(): LayersManager;
	getToolManager(): ToolManager;
	getHistoryManager(): HistoryManager;
	getFontManager(): FontManager;
	getRenderManager(): RenderManager;
	getCommandRegistry(): CommandRegistry;
	getCommands(): EditorCommands;
	getSelectionManager(): SelectionManager;
	getSmartObjectsManager(): SmartObjectsManager;
	getFeedbackManager(): FeedbackManager;
	getClipboardManager(): ClipboardManager;
	getSerializer(): AppSerializer;

	getConfig(): Config;
	getCursor(): Cursor;

	getUI(): UI;

	render(): void;
};

export interface CoreDependencies {
	config: Config;
	fontManager: FontManager;
	historyManager: HistoryManager;
	cursor: Cursor;
	toolManager: ToolManager;
	ui: UI;
	renderManager: RenderManager;
	selectionManager: SelectionManager;
	smartObjectsManager: SmartObjectsManager;
	feedbackManager: FeedbackManager;
	clipboardManager: ClipboardManager;
	serializer: AppSerializer;

	camera: ICamera;
	layersManager: LayersManager;
}

export class Core implements CoreApi {
	private toolManager: ToolManager;
	private camera: ICamera;
	private layers: LayersManager;
	private cursor: Cursor;
	private history: HistoryManager;
	private config: Config;
	private fontManager: FontManager;
	private renderManager: RenderManager;
	private ui: UI;
	private selectionManager: SelectionManager;
	private smartObjectsManager: SmartObjectsManager;
	private feedbackManager: FeedbackManager;
	private clipboardManager: ClipboardManager;
	private serializer: AppSerializer;
	private commandRegistry: CommandRegistry;

	constructor({
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
	}: CoreDependencies) {
		this.camera = camera;
		this.fontManager = fontManager;
		this.history = historyManager;
		this.config = config;
		this.layers = layersManager;
		this.cursor = cursor;
		this.toolManager = toolManager;
		this.ui = ui;
		this.renderManager = renderManager;
		this.selectionManager = selectionManager;
		this.smartObjectsManager = smartObjectsManager;
		this.feedbackManager = feedbackManager;
		this.clipboardManager = clipboardManager;
		this.serializer = serializer;
		this.commandRegistry = new CommandRegistry();
	}

	getSerializer(): AppSerializer {
		return this.serializer;
	}
	getCommandRegistry(): CommandRegistry {
		return this.commandRegistry;
	}
	getCommands(): EditorCommands {
		return this.commandRegistry;
	}
	getFeedbackManager(): FeedbackManager {
		return this.feedbackManager;
	}
	getClipboardManager(): ClipboardManager {
		return this.clipboardManager;
	}
	getCamera(): ICamera {
		return this.camera;
	}
	getSmartObjectsManager(): SmartObjectsManager {
		return this.smartObjectsManager;
	}
	getSelectionManager(): SelectionManager {
		return this.selectionManager;
	}
	getLayersManager(): LayersManager {
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
