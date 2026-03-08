import type { CellRectangle, ICamera } from '@editor/types';
import {
	HandlePosition,
	SelectionModeName,
	type ISelectionMode,
	type ResizingModePayload
} from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { cellToWorld, worldToCell } from '@editor/utils';

export class ResizingMode implements ISelectionMode<SelectionModeName.RESIZING> {
	readonly name = SelectionModeName.RESIZING;

	private camera: ICamera;
	private originalRect: CellRectangle | null = null;
	private startPointInCells: { x: number; y: number } | null = null;
	private handle: HandlePosition | null = null;
	private lastSentDelta: { dx: number; dy: number; dw: number; dh: number } = {
		dx: 0,
		dy: 0,
		dw: 0,
		dh: 0
	};
	private readonly handleHitboxSize = 16;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
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

	public onEnter(_: SelectionModeContext, payload: ResizingModePayload): void {
		const { mouseDownEvent, handle } = payload;
		const cursorName = this.getCursorForHandle(handle);

		this.coreApi.getCursor().setCursor(cursorName);
		const pos = this.camera.getMousePosition({
			x: mouseDownEvent.clientX,
			y: mouseDownEvent.clientY
		});
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;

		this.startPointInCells = worldToCell({ charWidth, charHeight }, worldPos.x, worldPos.y);

		this.originalRect = this.selectionManager.getActiveSession()?.boundingBox ?? null;

		this.handle = handle;
		this.lastSentDelta = { dx: 0, dy: 0, dw: 0, dh: 0 };
	}

	public onExit(): void {
		this.startPointInCells = null;
		this.originalRect = null;
		this.handle = null;
	}

	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent) {
		if (!this.startPointInCells || !this.originalRect || this.handle === null) return;

		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const currentCell = worldToCell({ charHeight, charWidth }, worldPos.x, worldPos.y);

		const deltaX = currentCell.x - this.startPointInCells.x;
		const deltaY = currentCell.y - this.startPointInCells.y;

		let dx = 0,
			dy = 0,
			dw = 0,
			dh = 0;

		if (
			this.handle === HandlePosition.TopLeft ||
			this.handle === HandlePosition.Left ||
			this.handle === HandlePosition.BottomLeft
		) {
			dx = deltaX;
			dw = -deltaX;
		}
		if (
			this.handle === HandlePosition.TopLeft ||
			this.handle === HandlePosition.Top ||
			this.handle === HandlePosition.TopRight
		) {
			dy = deltaY;
			dh = -deltaY;
		}

		if (
			this.handle === HandlePosition.TopRight ||
			this.handle === HandlePosition.Right ||
			this.handle === HandlePosition.BottomRight
		) {
			dw = deltaX;
		}

		if (
			this.handle === HandlePosition.BottomLeft ||
			this.handle === HandlePosition.Bottom ||
			this.handle === HandlePosition.BottomRight
		) {
			dh = deltaY;
		}

		if (this.originalRect.width + dw < 1) {
			dw = 1 - this.originalRect.width;
			if (dx !== 0) dx = -dw;
		}
		if (this.originalRect.height + dh < 1) {
			dh = 1 - this.originalRect.height;
			if (dy !== 0) dy = -dh;
		}

		const deltaToSend = {
			dx: dx - this.lastSentDelta.dx,
			dy: dy - this.lastSentDelta.dy,
			dw: dw - this.lastSentDelta.dw,
			dh: dh - this.lastSentDelta.dh
		};

		if (deltaToSend.dx || deltaToSend.dy || deltaToSend.dw || deltaToSend.dh) {
			this.selectionManager.resizeSelection(deltaToSend, { recordHistory: false });
			this.lastSentDelta = { dx, dy, dw, dh };
		}
	}

	public handleMouseUp(event: MouseEvent, context: SelectionModeContext): void {
		this.selectionManager.resizeSelection({ dx: 0, dy: 0, dw: 0, dh: 0 }, { recordHistory: true });
		context.transitionTo(SelectionModeName.SELECTED, { mouseEvent: event });
	}

	getHandleAt(worldX: number, worldY: number): HandlePosition | null {
		const activeSession = this.selectionManager.getActiveSession();
		if (!activeSession) return null;

		const smartObject = activeSession.getSelectedObjects();

		if (smartObject.length > 1) return null;

		const isResizableCapable = smartObject.every((object) => object.capabilities.canResize);
		if (!isResizableCapable) return null;

		const selection = activeSession;
		if (!selection) return null;

		const handleHitboxRadius = this.handleHitboxSize / 2 / this.camera.scale;

		const {
			cellX: boundingBoxStartX,
			cellY: boundingBoxStartY,
			width: boundingBoxWidth,
			height: boundingBoxHeight
		} = selection.boundingBox;
		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;
		const { x: startX, y: startY } = cellToWorld({
			charWidth,
			charHeight,
			cellX: boundingBoxStartX,
			cellY: boundingBoxStartY
		});
		const { x: endX, y: endY } = cellToWorld({
			charWidth,
			charHeight,
			cellX: boundingBoxStartX + boundingBoxWidth,
			cellY: boundingBoxStartY + boundingBoxHeight
		});

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
