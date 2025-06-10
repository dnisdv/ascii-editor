import type { ICamera } from '@editor/types';
import {
	SelectionModeName,
	type ISelectionMode,
	type ResizingModePayload,
	HandlePosition
} from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { CoreApi } from '@editor/core';
import type { Rectangle } from '../session/selection-session';

export class ResizingMode implements ISelectionMode<SelectionModeName.RESIZING> {
	readonly name = SelectionModeName.RESIZING;

	private camera: ICamera;
	private startPointInCells: { x: number; y: number } | null = null;
	private originalRect: Rectangle | null = null;
	private handle: HandlePosition | null = null;
	private readonly handleHitboxSize = 16;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager
	) {
		this.camera = this.coreApi.getCamera();
	}

	public getName(): string {
		return this.name;
	}

	public getCursorForHandle(handle: HandlePosition | null): string {
		if (handle === null) return 'default';
		switch (handle) {
			case HandlePosition.TopLeft:
			case HandlePosition.BottomRight:
				return 'resize-nwse';
			case HandlePosition.TopRight:
			case HandlePosition.BottomLeft:
				return 'resize-nesw';
			case HandlePosition.Top:
			case HandlePosition.Bottom:
				return 'resize-ns';
			case HandlePosition.Left:
			case HandlePosition.Right:
				return 'resize-ew';
			default:
				return 'default';
		}
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

	public onEnter(_: SelectionModeContext, payload: ResizingModePayload): void {
		const { mouseDownEvent, handle } = payload;
		const cursorName = this.getCursorForHandle(handle);

		this.coreApi.getCursor().setCursor(cursorName);
		const pos = this.camera.getMousePosition({
			x: mouseDownEvent.clientX,
			y: mouseDownEvent.clientY
		});
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		this.startPointInCells = this.worldToCellPos(worldPos.x, worldPos.y);
		this.originalRect =
			this.selectionSessionManager.getActiveSession()?.getSelectedRegion() ?? null;
		this.handle = handle;
	}

	public onExit(): void {
		this.startPointInCells = null;
		this.originalRect = null;
		this.handle = null;
	}

	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent) {
		if (!this.startPointInCells || !this.originalRect || this.handle === null) return;

		const cursorName = this.getCursorForHandle(this.handle);
		this.coreApi.getCursor().setCursor(cursorName);

		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const currentCell = this.worldToCellPos(worldPos.x, worldPos.y);

		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		const { startX, startY, width, height } = this.originalRect;

		const startCellOriginal = this.worldToCellPos(startX, startY);
		const endCellOriginal = this.worldToCellPos(startX + width, startY + height);

		const deltaX = currentCell.x - this.startPointInCells.x;
		const deltaY = currentCell.y - this.startPointInCells.y;

		let newStartCellX = startCellOriginal.x;
		let newStartCellY = startCellOriginal.y;
		let newEndCellX = endCellOriginal.x;
		let newEndCellY = endCellOriginal.y;

		if (
			this.handle === HandlePosition.TopLeft ||
			this.handle === HandlePosition.Top ||
			this.handle === HandlePosition.TopRight
		) {
			newStartCellY += deltaY;
		}
		if (
			this.handle === HandlePosition.BottomLeft ||
			this.handle === HandlePosition.Bottom ||
			this.handle === HandlePosition.BottomRight
		) {
			newEndCellY += deltaY;
		}

		if (
			this.handle === HandlePosition.TopLeft ||
			this.handle === HandlePosition.Left ||
			this.handle === HandlePosition.BottomLeft
		) {
			newStartCellX += deltaX;
		}
		if (
			this.handle === HandlePosition.TopRight ||
			this.handle === HandlePosition.Right ||
			this.handle === HandlePosition.BottomRight
		) {
			newEndCellX += deltaX;
		}

		const newWorldStart = this.cellToWorldPos(newStartCellX, newStartCellY);
		const newWorldEnd = this.cellToWorldPos(newEndCellX, newEndCellY);

		activeSession.updateSelectedRegion({
			startX: newWorldStart.x,
			startY: newWorldStart.y,
			width: newWorldEnd.x - newWorldStart.x,
			height: newWorldEnd.y - newWorldStart.y
		});
	}

	public handleMouseUp(_: MouseEvent, context: SelectionModeContext): void {
		const activeSession = this.selectionSessionManager.getActiveSession();
		const selectedRegion = activeSession?.getSelectedRegion();
		if (activeSession && selectedRegion) {
			const {
				dimensions: { width: charWidth, height: charHeight }
			} = this.coreApi.getFontManager().getMetrics();

			const newRegion = { ...selectedRegion };
			if (newRegion.width < charWidth) newRegion.width = charWidth;
			if (newRegion.height < charHeight) newRegion.height = charHeight;

			activeSession.updateSelectedRegion(newRegion);
		}

		context.transitionTo(SelectionModeName.SELECTED);
	}

	getHandleAt(worldX: number, worldY: number): HandlePosition | null {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return null;

		const selection = activeSession.getSelectedRegion();
		if (!selection) return null;

		const handleHitboxRadius = this.handleHitboxSize / 2 / this.camera.scale;

		const { startX, startY, width, height } = selection;
		const endX = startX + width;
		const endY = startY + height;

		const onTop = worldY > startY - handleHitboxRadius && worldY < startY + handleHitboxRadius;
		const onBottom = worldY > endY - handleHitboxRadius && worldY < endY + handleHitboxRadius;
		const onLeft = worldX > startX - handleHitboxRadius && worldX < startX + handleHitboxRadius;
		const onRight = worldX > endX - handleHitboxRadius && worldX < endX + handleHitboxRadius;

		const inVertical = worldY > startY + handleHitboxRadius && worldY < endY - handleHitboxRadius;
		const inHorizontal = worldX > startX + handleHitboxRadius && worldX < endX - handleHitboxRadius;

		if (onTop && onLeft) return HandlePosition.TopLeft;
		if (onTop && onRight) return HandlePosition.TopRight;
		if (onBottom && onLeft) return HandlePosition.BottomLeft;
		if (onBottom && onRight) return HandlePosition.BottomRight;

		if (onTop && inHorizontal) return HandlePosition.Top;
		if (onBottom && inHorizontal) return HandlePosition.Bottom;
		if (onLeft && inVertical) return HandlePosition.Left;
		if (onRight && inVertical) return HandlePosition.Right;

		return null;
	}
}
