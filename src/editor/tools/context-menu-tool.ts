import type { CoreApi } from '@editor/core';
import { BaseTool, type ITool } from '../tool';
import { Keybindings } from '@editor/context-menu';
import type { MenuContext } from '@editor/context-menu';
import { EditorCommand } from '@editor/commands/ids';

export class ContextMenuTool extends BaseTool implements ITool {
	readonly visible = false;

	private rmbDown = false;
	private rmbStartX = 0;
	private rmbStartY = 0;
	private rmbDragging = false;
	private suppressNextContextMenu = false;
	private readonly DRAG_THRESHOLD_PX = 4;

	constructor(protected coreApi: CoreApi) {
		super({
			name: 'context-menu',
			isVisible: false,
			config: {},
			coreApi
		});

		this.registerShortcuts();
		this.registerMouseEvents();
	}

	private registerMouseEvents(): void {
		const eventManager = this.coreApi.getToolManager().toolEventManager;
		const toolApi = eventManager.toolApi(this);

		toolApi.registerMouseDown('right', (e) => this.onMouseDown(e), true);
		toolApi.registerMouseMove((e) => this.onMouseMove(e), true);
		toolApi.registerMouseUp((e) => this.onMouseUp(e), true);
		toolApi.registerRightClick((e) => this.onContextMenu(e), true);
	}

	activate(): void {}

	deactivate(): void {}

	private registerShortcuts() {
		const commands = this.coreApi.getCommands();
		const eventManager = this.coreApi.getToolManager().toolEventManager;

		for (const [commandId, keyOrKeys] of Object.entries(Keybindings)) {
			const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
			keys.forEach((key) => {
				eventManager.registerGlobalShortcut(key, (e) => {
					e.preventDefault();
					commands.execute(commandId);
				});
			});
		}
	}

	private onMouseDown(e: MouseEvent) {
		if (e.button === 2) {
			this.rmbDown = true;
			this.rmbDragging = false;
			this.rmbStartX = e.clientX;
			this.rmbStartY = e.clientY;
		}
	}

	private onMouseMove(e: MouseEvent) {
		if (this.rmbDown && e.buttons & 2) {
			if (!this.rmbDragging) {
				const dx = Math.abs(e.clientX - this.rmbStartX);
				const dy = Math.abs(e.clientY - this.rmbStartY);
				if (dx >= this.DRAG_THRESHOLD_PX || dy >= this.DRAG_THRESHOLD_PX) {
					this.rmbDragging = true;
				}
			}
		}
	}

	private onMouseUp(e: MouseEvent) {
		if (e.button === 2) {
			const dx = Math.abs(e.clientX - this.rmbStartX);
			const dy = Math.abs(e.clientY - this.rmbStartY);
			const didDrag =
				this.rmbDragging || dx >= this.DRAG_THRESHOLD_PX || dy >= this.DRAG_THRESHOLD_PX;

			if (!didDrag) {
				this.openMenu(e);
			}

			this.suppressNextContextMenu = true;

			this.rmbDown = false;
			this.rmbDragging = false;
		}
	}

	private onContextMenu(e: MouseEvent) {
		e.preventDefault();

		if (this.suppressNextContextMenu) {
			this.suppressNextContextMenu = false;
			return;
		}
	}

	private openMenu(e: MouseEvent) {
		const world = this.worldFromEvent(e);
		const target = this.effectiveTarget(world);
		const selected = this.selectedObjects();
		const ctx = this.buildContext(target, selected);

		this.coreApi.getCommands().execute(EditorCommand.ViewShowContextMenu, {
			x: e.clientX,
			y: e.clientY,
			context: ctx
		});
	}

	private worldFromEvent(e: MouseEvent) {
		const camera = this.coreApi.getCamera();
		const mouse = camera.getMousePosition({ x: e.clientX, y: e.clientY });
		return camera.screenToWorld(mouse.x, mouse.y);
	}

	private effectiveTarget(world: { x: number; y: number }): 'canvas' | 'selection' {
		const insideRegion = this.coreApi
			.getSelectionManager()
			.isPointInsideSelectionWorld(world.x, world.y);
		return insideRegion ? 'selection' : 'canvas';
	}

	private selectedObjects() {
		return this.coreApi.getSelectionManager().getActiveSession()?.getSelectedObjects() ?? [];
	}

	private buildContext(target: 'canvas' | 'selection', selected: unknown[]): MenuContext {
		return {
			target,
			selectedCount: target === 'selection' ? selected.length : 0,
			data:
				target === 'selection' && selected.length > 0 ? { selectedObjects: selected } : undefined
		};
	}

	update(): void {}
}
