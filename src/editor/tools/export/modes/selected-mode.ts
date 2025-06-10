import {
	HandlePosition,
	SelectionModeName,
	type ISelectionMode,
	type SelectedModePayload
} from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';
import { ResizingMode } from './resizing-mode';

export class SelectedMode implements ISelectionMode<SelectionModeName.SELECTED> {
	readonly name = SelectionModeName.SELECTED;
	private camera: ICamera;
	private hoveredHandle: HandlePosition | null = null;
	private isHoveringMoveArea: boolean = false;
	private readonly handleHitboxSize = 16;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager
	) {
		this.camera = this.coreApi.getCamera();
	}

	getName(): string {
		return this.name;
	}
	onEnter(context: SelectionModeContext, payload?: SelectedModePayload): void {
		if (payload?.mouseEvent) {
			this.handleMouseMove(payload.mouseEvent, context);
		}
	}
	onExit(): void {
		this.hoveredHandle = null;
		this.isHoveringMoveArea = false;
		this.coreApi.getCursor().setCursor('default');
	}

	public getHoveredHandle(): HandlePosition | null {
		return this.hoveredHandle;
	}

	public isMouseInside(): boolean {
		return this.isHoveringMoveArea;
	}

	handleMouseDown(event: MouseEvent, context: SelectionModeContext): void {
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		const resizingMode = context.getMode(SelectionModeName.RESIZING) as ResizingMode;
		const handle = resizingMode.getHandleAt(worldPos.x, worldPos.y);

		if (handle !== null) {
			context.transitionTo(SelectionModeName.RESIZING, { mouseDownEvent: event, handle });
		} else if (this.isPointInsideMoveArea(worldPos.x, worldPos.y)) {
			context.transitionTo(SelectionModeName.MOVING, { mouseDownEvent: event });
		} else {
			context.transitionTo(SelectionModeName.SELECTING, { mouseDownEvent: event });
		}
	}

	handleMouseMove(event: MouseEvent, context: SelectionModeContext) {
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		const resizingMode = context.getMode(SelectionModeName.RESIZING) as ResizingMode;
		const newHoveredHandle = resizingMode.getHandleAt(worldPos.x, worldPos.y);

		const wasHoveringMove = this.isHoveringMoveArea;
		this.isHoveringMoveArea =
			this.isPointInsideMoveArea(worldPos.x, worldPos.y) && !newHoveredHandle;
		if (wasHoveringMove !== this.isHoveringMoveArea) {
			this.coreApi.getRenderManager().requestRender();
		}

		if (newHoveredHandle !== this.hoveredHandle) {
			this.hoveredHandle = newHoveredHandle;
			this.coreApi.getRenderManager().requestRender();
		}

		const resizingCtx = context.getMode(SelectionModeName.RESIZING)!;
		const cursorName = resizingCtx.getCursorForHandle(this.hoveredHandle);
		this.coreApi.getCursor().setCursor(cursorName);
	}

	handleMouseUp(): void {}

	private isPointInsideSelection(worldX: number, worldY: number): boolean {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return false;

		const rectangle = activeSession.getSelectedRegion();
		if (!rectangle) return false;

		const { startX, startY, width, height } = rectangle;
		return (
			worldX >= startX && worldX <= startX + width && worldY >= startY && worldY <= startY + height
		);
	}

	private isPointInsideMoveArea(worldX: number, worldY: number): boolean {
		if (!this.isPointInsideSelection(worldX, worldY)) return false;

		const activeSession = this.selectionSessionManager.getActiveSession()!;
		const rectangle = activeSession.getSelectedRegion()!;
		const margin = this.handleHitboxSize / 2 / this.camera.scale;
		const { startX, startY, width, height } = rectangle;

		const innerLeft = startX + margin;
		const innerTop = startY + margin;
		const innerRight = startX + width - margin;
		const innerBottom = startY + height - margin;

		if (innerLeft > innerRight || innerTop > innerBottom) return true;
		return (
			worldX >= innerLeft && worldX <= innerRight && worldY >= innerTop && worldY <= innerBottom
		);
	}
}
