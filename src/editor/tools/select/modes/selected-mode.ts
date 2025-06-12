import { SelectionModeName, type ISelectionMode } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';

export class SelectedMode implements ISelectionMode<SelectionModeName.SELECTED> {
	readonly name = SelectionModeName.SELECTED;
	private camera: ICamera;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager
	) {
		this.camera = this.coreApi.getCamera();
	}

	getName(): string {
		return this.name;
	}

	onEnter(): void { }
	onExit(): void {
		this.coreApi.getCursor().setCursor('default');
	}

	handleMouseDown(event: MouseEvent, context: SelectionModeContext): void {
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const activeSession = this.selectionSessionManager.getActiveSession();
		const selectedContent = activeSession?.getSelectedContent();
		const rotatingMode = context.getMode(SelectionModeName.ROTATING)!;

		if (this.isMouseInsideSelected(pos.x, pos.y)) {
			context.transitionTo(SelectionModeName.MOVING, { mouseDownEvent: event });
		} else if (
			selectedContent &&
			selectedContent.data.length > 1 &&
			rotatingMode.isMouseNearCorner({ x: pos.x, y: pos.y })
		) {
			context.transitionTo(SelectionModeName.ROTATING, { mouseDownEvent: event });
		} else {
			context.transitionTo(SelectionModeName.SELECTING, { mouseDownEvent: event });
		}
	}

	handleMouseMove(event: MouseEvent, context: SelectionModeContext) {
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const rotatingMode = context.getMode(SelectionModeName.ROTATING)!;
		rotatingMode.isMouseNearCorner({ x: pos.x, y: pos.y });
	}

	handleMouseUp(): void { }

	isMouseInsideSelected(mouseX: number, mouseY: number): boolean {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return false;

		const worldPos = this.camera.screenToWorld(mouseX, mouseY);
		const rectangle = activeSession.getSelectedRegion();
		if (!rectangle) return false;

		const { startX, startY, width, height } = rectangle;

		const x = startX;
		const y = startY;
		const endX = startX + width;
		const endY = startY + height;

		return worldPos.x >= x && worldPos.x <= endX && worldPos.y >= y && worldPos.y <= endY;
	}
}
