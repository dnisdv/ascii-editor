import type { ICamera } from '@editor/types';
import { SelectionModeName, type ISelectionMode, type MovingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { Rectangle } from '../session/selection-session';

export class MovingMode implements ISelectionMode<SelectionModeName.MOVING> {
	readonly name = SelectionModeName.MOVING;
	private camera: ICamera;
	private startPointInCells: { x: number; y: number } | null = null;
	private originalRect: Rectangle | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager
	) {
		this.camera = this.coreApi.getCamera();
	}

	private worldToCellPos(x: number, y: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		return { x: Math.round(x / charWidth), y: Math.round(y / charHeight) };
	}

	private cellToWorldPos(x: number, y: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		return { x: x * charWidth, y: y * charHeight };
	}

	public getName(): string {
		return this.name;
	}

	public onEnter(_: SelectionModeContext, payload: MovingModePayload): void {
		const { mouseDownEvent } = payload;
		const pos = this.camera.getMousePosition({
			x: mouseDownEvent.clientX,
			y: mouseDownEvent.clientY
		});
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		this.startPointInCells = this.worldToCellPos(worldPos.x, worldPos.y);
		this.originalRect =
			this.selectionSessionManager.getActiveSession()?.getSelectedRegion() ?? null;
	}

	public onExit(): void {
		this.startPointInCells = null;
		this.originalRect = null;
	}
	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent) {
		if (!this.startPointInCells || !this.originalRect) return;

		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const currentCell = this.worldToCellPos(worldPos.x, worldPos.y);

		const deltaX = currentCell.x - this.startPointInCells.x;
		const deltaY = currentCell.y - this.startPointInCells.y;

		const originalRectCell = this.worldToCellPos(
			this.originalRect.startX,
			this.originalRect.startY
		);

		const newStartCellX = originalRectCell.x + deltaX;
		const newStartCellY = originalRectCell.y + deltaY;

		const newWorldStart = this.cellToWorldPos(newStartCellX, newStartCellY);

		activeSession.updateSelectedRegion({
			...this.originalRect,
			startX: newWorldStart.x,
			startY: newWorldStart.y
		});
	}

	public handleMouseUp(_: MouseEvent, context: SelectionModeContext): void {
		context.transitionTo(SelectionModeName.SELECTED);
	}
}
