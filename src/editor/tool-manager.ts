import type { ITool } from './tool';
import type { IToolOptions } from './types/external/tool';
import type { ICanvas, ToolsManagerEvents } from './types';
import { ToolEventManager } from './tools-event-manager';
import { VimKeyMapper } from './utils/hotkey';
import { EventEmitter } from './event-emitter';

export interface ToolManagerOptions {
	canvas: ICanvas;
}

export class ToolManager extends EventEmitter<ToolsManagerEvents> {
	private tools: Map<string, ITool> = new Map();
	private hotkeyMap: Map<string, ITool> = new Map();
	private activeTool: string | null = null;
	toolEventManager: ToolEventManager;

	constructor({ canvas }: ToolManagerOptions) {
		super();
		this.toolEventManager = new ToolEventManager(canvas);
		window.addEventListener('keydown', (e) => this.handleHotkey(e));
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
	}

	public registerTool(tool: ITool): void {
		if (this.tools.has(tool.name)) {
			console.warn(`Tool ${tool.name} is already registered.`);
			return;
		}
		this.tools.set(tool.name, tool);
		if (tool.hotkey) {
			if (this.hotkeyMap.has(tool.hotkey)) {
				throw Error('Tool with hotkey' + tool.hotkey + 'Already registered');
			} else {
				this.hotkeyMap.set(tool.hotkey, tool);
			}
		}

		this.emit('tool::registered', { name: tool.name, config: tool.config });
		this.proxy(tool, {
			prefixes: ['tool::', `tool::${tool.name}::`],
			events: ['config::changed'],
			transform: (_, payload) => ({ name: tool.name, config: payload })
		});
	}

	public unregisterTool(toolName: string): void {
		const tool = this.tools.get(toolName);
		if (!tool) return;

		tool.cleanup();
		this.tools.delete(toolName);
		this.activeTool = this.activeTool === toolName ? null : this.activeTool;
		if (tool.hotkey) this.hotkeyMap.delete(tool.hotkey);

		this.unproxy(tool);
	}

	public activateTool(toolName: string): void {
		const tool = this.tools.get(toolName);
		if (!tool) return;

		if (toolName === this.activeTool) return;

		this.deactivateTool();
		tool.activate();
		this.activeTool = toolName;
		this.emit('tool::activated', { name: toolName });
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

	private handleHotkey(event: KeyboardEvent): void {
		const normalizedHotkey = VimKeyMapper.normalizeKeyEvent(event);
		const tool = this.hotkeyMap.get(normalizedHotkey);
		if (tool) {
			this.activateTool(tool.name);
			event.preventDefault();
		}
	}
}
