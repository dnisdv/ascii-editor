import { ToolEventManager } from './tools-event-manager';

import type { ITool } from './tool';
import type { BaseBusTools } from './bus-tools';
import type { IToolModel, IToolOptions } from './types/external/tool';
import { VimKeyMapper } from './utils/hotkey';
import type { ICanvas } from './types';
import { EventEmitter } from './event-emitter';

export interface ToolManagerOptions {
	toolBus: BaseBusTools;
	canvas: ICanvas;
}

type ToolEventMap = {
	'tool::activate': Pick<IToolModel, 'name'>;
};

export class ToolManager extends EventEmitter<ToolEventMap> {
	private tools: Map<string, ITool> = new Map();
	private hotkeyMap: Map<string, ITool> = new Map();
	private activeTool: string | null = null;
	private toolBus: BaseBusTools;
	toolEventManager: ToolEventManager;

	constructor({ toolBus, canvas }: ToolManagerOptions) {
		super();
		this.toolEventManager = new ToolEventManager(canvas);
		this.toolBus = toolBus;

		this.initializeEventListeners();
		window.addEventListener('keydown', (e) => this.handleHotkey(e));
	}

	private initializeEventListeners(): void {
		this.toolBus.on('tool::activate::request', this.handleActivateRequest.bind(this));
		this.toolBus.on('tool::deactivate::request', this.handleDeactivateRequest.bind(this));
		this.toolBus.on('tool::deactivate_all::request', this.handleDeactivateAllRequest.bind(this));
		this.toolBus.on('tool::update_config::request', this.handleUpdateConfig.bind(this));
	}

	public getActiveTool(): ITool | null {
		if (!this.activeTool) return null;
		return this.tools.get(this.activeTool) || null;
	}

	public getActiveToolName(): string | null {
		return this.activeTool;
	}

	public handleUpdateConfig({ name, config }: { name: string; config: IToolOptions }) {
		const tool = this.tools.get(name);
		if (!tool) {
			console.warn(`Tool ${name} not found.`);
			return;
		}

		tool.config = { ...tool.config, ...config };

		if (tool.update) {
			tool.update();
		}

		this.toolBus.emit('tool::update_config::response', { name, config });
	}

	public registerTool(tool: ITool): void {
		if (this.tools.has(tool.name)) {
			console.warn(`Tool ${tool.name} is already registered.`);
			return;
		}
		this.tools.set(tool.name, tool);
		this.toolBus.emit('tool::register::response', {
			name: tool.name,
			isVisible: tool.isVisible,
			config: tool.config
		});

		if (tool.hotkey) {
			if (this.hotkeyMap.has(tool.hotkey)) {
				throw Error('Tool with hotkey' + tool.hotkey + 'Already registered');
			} else {
				this.hotkeyMap.set(tool.hotkey, tool);
			}
		}
	}

	public unregisterTool(toolName: string): void {
		const tool = this.tools.get(toolName);
		if (!tool) return;

		tool.cleanup();
		this.tools.delete(toolName);
		this.activeTool = this.activeTool === toolName ? null : this.activeTool;
		if (tool.hotkey) this.hotkeyMap.delete(tool.hotkey);
	}

	public activateTool(toolName: string): void {
		const tool = this.tools.get(toolName);
		if (!tool) return;

		if (toolName === this.activeTool) return;

		this.deactivateTool();
		tool.activate();
		this.activeTool = toolName;
		this.toolBus.emit('tool::activate::response', { name: toolName });
		this.emit('tool::activate', { name: toolName });
	}

	public deactivateTool(): void {
		if (this.activeTool) {
			const tool = this.tools.get(this.activeTool);
			if (tool) {
				tool.deactivate();
				this.activeTool = null;
			}
		}
	}

	public deactivateAllTools(): void {
		this.tools.forEach((tool) => tool.deactivate());
		this.activeTool = null;
		this.toolBus.emit('tool::deactivate_all::response');
	}

	public getTools(): ITool[] {
		return Array.from(this.tools.values());
	}

	public getTool(name: string): ITool | undefined {
		return this.tools.get(name);
	}

	public getToolApi<T>(name: string): T | undefined {
		return this.tools.get(name)?.getApi() as T | undefined;
	}

	public isActive(toolName: string): boolean {
		return this.activeTool === toolName;
	}

	public setDefaultTool(tool: ITool): void {
		if (!this.tools.has(tool.name)) {
			console.warn(`Tool ${tool.name} is not registered. Cannot set as default.`);
			return;
		}
		this.activateTool(tool.name);
	}

	private handleActivateRequest({ name }: Pick<IToolModel, 'name'>): void {
		this.activateTool(name);
	}

	private handleDeactivateRequest(): void {
		const activeTool = this.activeTool;
		this.deactivateTool();
		if (activeTool) {
			this.toolBus.emit('tool::deactivate::response', { name: activeTool });
		}
	}

	private handleDeactivateAllRequest(): void {
		this.deactivateAllTools();
		this.toolBus.emit('tool::deactivate_all::response');
	}

	private handleHotkey(event: KeyboardEvent): void {
		const normalizedHotkey = VimKeyMapper.normalizeKeyEvent(event);
		const tool = this.hotkeyMap.get(normalizedHotkey);
		if (tool) {
			this.activateTool(tool.name);
			event.preventDefault();
		}
	}
}
