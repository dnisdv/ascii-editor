import type { CoreApi } from './core.type';
import { ToolEventManager } from './tools-event-manager';

import type { ITool } from './tool';
import type { BaseBusTools } from './bus-tools';
import type { IToolModel, IToolOptions } from './types/external/tool';
import { VimKeyMapper } from './utils/hotkey';

export class ToolManager {
  private tools: Map<string, ITool> = new Map();
  private hotkeyMap: Map<string, ITool> = new Map();
  private activeTool: string | null = null;
  private toolBus: BaseBusTools
  toolEventManager: ToolEventManager

  constructor(core: CoreApi) {
    this.toolEventManager = new ToolEventManager(core)
    this.toolBus = core.getBusManager().tools;

    this.initializeEventListeners();
    window.addEventListener('keydown', (e) => this.handleHotkey(e));
  }

  private initializeEventListeners(): void {
    this.toolBus.on('tool::activate::request', this.handleActivateRequest.bind(this));
    this.toolBus.on('tool::deactivate::request', this.handleDeactivateRequest.bind(this));
    this.toolBus.on('tool::deactivate_all::request', this.handleDeactivateAllRequest.bind(this));
    this.toolBus.on('tool::update_config::request', this.handleUpdateConfig.bind(this))
  }

  handleUpdateConfig({ name, config }: { name: string, config: IToolOptions }) {
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

  registerTool(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered.`);
      return;
    }
    this.tools.set(tool.name, tool);
    this.toolBus.emit('tool::register::response', { name: tool.name, isVisible: tool.isVisible, config: tool.config })

    if (tool.hotkey) {
      if (this.hotkeyMap.has(tool.hotkey)) {
        console.error(`key "${tool.hotkey}" already assigned.`);
      } else {
        this.hotkeyMap.set(tool.hotkey, tool);
      }
    }
  }

  unregisterTool(toolName: string): void {
    const tool = this.tools.get(toolName);
    if (tool) {
      tool.cleanup();
      this.tools.delete(toolName);
    }
  }

  activateTool(toolName: string): void {
    const tool = this.tools.get(toolName);
    if (!tool) return;;

    if (toolName !== this.activeTool) {
      this.deactivateTool();
    }

    tool.activate();
    this.activeTool = toolName;
    this.toolBus.emit('tool::activate::response', { name: toolName })
  }

  deactivateTool(): void {
    if (this.activeTool) {
      const tool = this.tools.get(this.activeTool);
      if (tool) {
        tool.deactivate();
        this.activeTool = null;
      }
    }
  }

  deactivateAllTools(): void {
    this.tools.forEach((tool) => tool.deactivate());
    this.activeTool = null;
  }

  getTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getToolApi<T>(name: string): T | undefined {
    return this.tools.get(name)?.getApi() as T | undefined;
  }

  isActive(toolName: string): boolean {
    return this.activeTool === toolName;
  }

  setDefaultTool(tool: ITool): void {
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

