import { SelectionModeName, type ISelectionMode, type MovingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';

export class MovingMode implements ISelectionMode<SelectionModeName.MOVING> {
	readonly name = SelectionModeName.MOVING;
	private startCell: { x: number; y: number } | null = null;
	private lastCell: { x: number; y: number } | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
	) {}

	public getName(): string {
		return this.name;
	}

	public onEnter(_: SelectionModeContext, payload: MovingModePayload): void {
		const { mouseDownEvent } = payload;
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		const pos = this.coreApi
			.getCamera()
			.getMousePosition({ x: mouseDownEvent.clientX, y: mouseDownEvent.clientY });
		const worldPos = this.coreApi.getCamera().screenToWorld(pos.x, pos.y);
		this.startCell = {
			x: Math.floor(worldPos.x / charWidth),
			y: Math.floor(worldPos.y / charHeight)
		};
		this.lastCell = this.startCell;
		this.coreApi.getCursor().setCursor('grabbing');
	}

	public onExit(): void {
		this.startCell = null;
		this.lastCell = null;
		this.coreApi.getCursor().setCursor('default');
	}

	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent) {
		if (!this.startCell || !this.lastCell) return;

		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		const pos = this.coreApi.getCamera().getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.coreApi.getCamera().screenToWorld(pos.x, pos.y);
		const currentCell = {
			x: Math.floor(worldPos.x / charWidth),
			y: Math.floor(worldPos.y / charHeight)
		};

		const deltaX = currentCell.x - this.lastCell.x;
		const deltaY = currentCell.y - this.lastCell.y;

		if (deltaX !== 0 || deltaY !== 0) {
			this.selectionManager.moveSelection(deltaX, deltaY, { recordHistory: false });
			this.lastCell = currentCell;
		}
	}

	public handleMouseUp(_: MouseEvent, context: SelectionModeContext): void {
		if (
			this.startCell &&
			this.lastCell &&
			(this.startCell.x !== this.lastCell.x || this.startCell.y !== this.lastCell.y)
		) {
			this.selectionManager.moveSelection(0, 0, { recordHistory: true });
		}
		context.transitionTo(SelectionModeName.SELECTED);
	}
}
