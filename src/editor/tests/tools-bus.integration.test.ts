import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Core, CoreApi } from '@editor/core';
import { createAppInstance } from '@editor/app';
import { BusManager } from '@editor/bus-manager';
import { BaseBusLayers } from '@editor/bus-layers';
import { BaseBusTools } from '@editor/bus-tools';
import { BaseBusNotification } from '@editor/bus-notification';
import { Camera } from '@editor/camera';
import * as cvk from '@editor/__mock__/canvaskit-wasm';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import { BaseTool, type ITool } from '@editor/tool';
import type { ToolManager } from '@editor/tool-manager';

vi.mock('canvaskit-wasm', () => cvk);

export class FakeTool extends BaseTool implements ITool {
	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			hotkey: '<A-v>',
			name: 'fakeTool1',
			isVisible: true,
			config: { option1: true },
			coreApi
		});
	}
	activate(): void {}
	deactivate(): void {}
	update(): void {}
}

export class FakeTool2 extends BaseTool implements ITool {
	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			hotkey: '<A-b>',
			name: 'fakeTool2',
			isVisible: true,
			config: { option1: true },
			coreApi
		});
	}
	activate(): void {}
	deactivate(): void {}
	update(): void {}
}

describe('Tool Bus Contract Integration Test', () => {
	let core: Core;
	let busManager: BusManager;
	let historyManager: HistoryManager;
	let fontManager: FontManager;
	let busTools: BaseBusTools;
	let toolManager: ToolManager;

	beforeEach(() => {
		busManager = new BusManager({
			layers: new BaseBusLayers(),
			tools: new BaseBusTools(),
			notifications: new BaseBusNotification()
		});

		const camera = new Camera(1200, 800);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const canvasKitInstance = cvk.CanvasKit as any;
		const appFontData = { buffer: new ArrayBuffer(8), family: '' };

		const gridEl = document.createElement('canvas');
		const selectCanvasElement = document.createElement('canvas');
		const asciiEl = document.createElement('canvas');

		const [_core] = createAppInstance({
			canvasKitInstance,
			gridCanvasElement: gridEl,
			selectCanvasElement,
			asciiCanvasElement: asciiEl,
			busManager,
			camera,
			font: appFontData
		});

		core = _core;
		toolManager = core.getToolManager();
		historyManager = core.getHistoryManager();
		fontManager = core.getFontManager();
		busTools = core.getBusManager().tools;

		core.getLayersManager().ensureLayer();
		vi.spyOn(fontManager, 'getMetrics').mockReturnValue({
			size: 18,
			dimensions: { width: 10, height: 18 },
			lineHeight: 22
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		historyManager.clear();
	});

	describe('Tool Registration', () => {
		it('should emit "tool::register::response" with correct payload when a tool is registered', () => {
			const listener = vi.fn();
			busTools.on('tool::register::response', listener);
			const fakeTool = new FakeTool(core);
			toolManager.registerTool(fakeTool);
			expect(listener).toHaveBeenCalledWith({
				name: fakeTool.name,
				isVisible: fakeTool.isVisible,
				config: fakeTool.config
			});
		});

		it('should not emit event if registration fail', () => {
			const fakeTool1 = new FakeTool(core);
			toolManager.registerTool(fakeTool1);
			const listener = vi.fn();
			busTools.on('tool::register::response', listener);

			const fakeTool2 = new FakeTool(core);
			toolManager.registerTool(fakeTool2);

			expect(listener).not.toHaveBeenCalled();
		});

		it("should register a tool without an initial config, defaulting to it's config in response", () => {
			const fakeTool = new FakeTool(core);
			const listener = vi.fn();
			busTools.on('tool::register::response', listener);
			toolManager.registerTool(fakeTool);

			expect(listener).toHaveBeenCalledWith({
				name: fakeTool.name,
				isVisible: fakeTool.isVisible,
				config: { option1: true }
			});
		});
	});

	describe('Tool Activation', () => {
		let fakeTool1: BaseTool;
		let fakeTool2: BaseTool;

		beforeEach(() => {
			fakeTool1 = new FakeTool(core);
			fakeTool2 = new FakeTool2(core);

			toolManager.registerTool(fakeTool1);
			toolManager.registerTool(fakeTool2);
		});

		it('should activate a tool and emit "tool::activate::response"', () => {
			const listener = vi.fn();

			busTools.on('tool::activate::response', listener);
			toolManager.activateTool('fakeTool1');

			expect(toolManager.getActiveToolName()).toBe(fakeTool1.name);
			expect(listener).toHaveBeenCalledWith({ name: fakeTool1.name });
		});

		it('should activate a tool and emit "tool::activate::response" via "tool::activate::request" bus event', () => {
			const listener = vi.fn();
			busTools.on('tool::activate::response', listener);
			busTools.emit('tool::activate::request', { name: fakeTool2.name });

			expect(toolManager.getActiveToolName()).toBe(fakeTool2.name);
			expect(listener).toHaveBeenCalledWith({ name: fakeTool2.name });
		});

		it('should not emit "tool::activate::response" if activating an already active tool', () => {
			toolManager.activateTool(fakeTool1.name);
			const listener = vi.fn();
			busTools.on('tool::activate::response', listener);
			toolManager.activateTool(fakeTool1.name);

			expect(listener).not.toHaveBeenCalled();
		});

		it('should do nothing and not emit if trying to activate a non-existent tool via ToolManager', () => {
			const listener = vi.fn();
			busTools.on('tool::activate::response', listener);
			toolManager.activateTool('nonExistentTool');
			expect(listener).not.toHaveBeenCalled();
			expect(toolManager.getActiveToolName()).toBeNull();
		});

		it('should do nothing and not emit if "tool::activate::request" is for a non-existent tool', () => {
			const listener = vi.fn();
			busTools.on('tool::activate::response', listener);
			busTools.emit('tool::activate::request', { name: 'nonExistentTool' });
			expect(listener).not.toHaveBeenCalled();
			expect(toolManager.getActiveToolName()).toBeNull();
		});
	});

	describe('Tool Deactivation', () => {
		let fakeTool1: BaseTool;
		let fakeTool2: BaseTool;

		beforeEach(() => {
			fakeTool1 = new FakeTool(core);
			fakeTool2 = new FakeTool2(core);

			toolManager.registerTool(fakeTool1);
			toolManager.registerTool(fakeTool2);

			toolManager.activateTool(fakeTool1.name);
		});

		it('should deactivate the active tool and emit "tool::deactivate::response" via "tool::deactivate::request" bus event', () => {
			const listener = vi.fn();
			busTools.on('tool::deactivate::response', listener);
			busTools.emit('tool::deactivate::request');

			expect(toolManager.getActiveToolName()).toBeNull();
			expect(listener).toHaveBeenCalledWith({ name: fakeTool1.name });
		});

		it('should not emit "tool::deactivate::response" if "tool::deactivate::request" is sent when no tool is active', () => {
			toolManager.deactivateTool();
			const listener = vi.fn();
			busTools.on('tool::deactivate::response', listener);

			busTools.emit('tool::deactivate::request');
			expect(listener).not.toHaveBeenCalled();
		});

		it('should deactivate all tools and emit "tool::deactivate_all::response" dirrectly', () => {
			const listener = vi.fn();
			busTools.on('tool::deactivate_all::response', listener);
			toolManager.deactivateAllTools();

			expect(toolManager.getActiveToolName()).toBeNull();
			expect(listener).toHaveBeenCalled();
		});

		it('should deactivate all tools and emit "tool::deactivate_all::response" via "tool::deactivate_all::request" bus event', () => {
			const listener = vi.fn();
			busTools.on('tool::deactivate_all::response', listener);
			busTools.emit('tool::deactivate_all::request');

			expect(toolManager.getActiveToolName()).toBeNull();
			expect(listener).toHaveBeenCalled();
		});

		it('should emit "tool::deactivate_all::response" even if no tools were active when "tool::deactivate_all::request" is emitted', () => {
			toolManager.deactivateTool();
			const listener = vi.fn();
			busTools.on('tool::deactivate_all::response', listener);
			busTools.emit('tool::deactivate_all::request');
			expect(listener).toHaveBeenCalled();
		});
	});

	describe('Tool Configuration Update', () => {
		let fakeTool1: BaseTool;
		let fakeTool2: BaseTool;

		beforeEach(() => {
			fakeTool1 = new FakeTool(core);
			fakeTool2 = new FakeTool2(core);

			toolManager.registerTool(fakeTool1);
			toolManager.registerTool(fakeTool2);

			toolManager.activateTool(fakeTool1.name);
		});

		it('should update tool config and emit "tool::update_config::response" via "tool::update_config::request" bus event', () => {
			const newConfig = { option1: 'newValueFromBus', newOption: true };
			const listener = vi.fn();
			busTools.on('tool::update_config::response', listener);

			busTools.emit('tool::update_config::request', { name: fakeTool1.name, config: newConfig });

			expect(fakeTool1.config).toEqual(expect.objectContaining(newConfig));
			expect(listener).toHaveBeenCalledWith({ name: fakeTool1.name, config: fakeTool1.config });
		});

		it('should emit "tool::update_config::request" when tools is changing it\'s config', () => {
			const listener = vi.fn();
			busTools.on('tool::update_config::request', listener);
			const configToSave = { initial: 'savedValue', added: 123 };

			fakeTool1.saveConfig(configToSave);

			expect(listener).toHaveBeenCalledWith({
				name: fakeTool1.name,
				config: { ...fakeTool1.config, ...configToSave }
			});
		});

		it('should not emit "tool::update_config::response" for a non-existent tool via bus request', () => {
			const listener = vi.fn();
			busTools.on('tool::update_config::response', listener);
			busTools.emit('tool::update_config::request', {
				name: 'nonExistentTool',
				config: { data: 'test' }
			});
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('Tool-Specific Bus Events', () => {
		it('should correctly scope emit and on for a registered tool', () => {
			const fakeTool1 = new FakeTool(core);
			toolManager.registerTool(fakeTool1);

			const tool1Bus = busTools.withTool(fakeTool1.name);
			const customEventListener = vi.fn();
			const eventPayload = { detail: 'specific data' };
			const eventName = 'customEventForTool1';

			tool1Bus.on(eventName, customEventListener);
			tool1Bus.emit(eventName, eventPayload);

			expect(customEventListener).toHaveBeenCalledWith(eventPayload);
		});
	});
});
