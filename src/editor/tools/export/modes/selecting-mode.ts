import { SelectionModeName, type ISelectionMode, type SelectingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { ICamera } from '@editor/types';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { SelectionRenderer } from '../renderer/selection-renderer';
import type { CoreApi } from '@editor/core';

export class SelectingMode implements ISelectionMode<SelectionModeName.SELECTING> {
	readonly name = SelectionModeName.SELECTING;
	private camera: ICamera;

	private startCell: { x: number; y: number } | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager,
		private selectionRender: SelectionRenderer
	) {
		this.camera = coreApi.getCamera();
	}

	public getName(): string {
		return this.name;
	}

	public onEnter(_: SelectionModeContext, payload: SelectingModePayload): void {
		this.selectionSessionManager.cancelActiveSession();
		this.selectionSessionManager.createAndReplaceActiveSession();

		const {
			mouseDownEvent: { clientX, clientY }
		} = payload;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		this.startCell = this.worldToCellPos(worldPos.x, worldPos.y);
	}

	private worldToCellPos(x: number, y: number) {
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();
		return { x: Math.floor(x / charWidth), y: Math.floor(y / charHeight) };
	}

	public cellToWorld(cellX: number, cellY: number) {
		const fontMetrics = this.coreApi.getFontManager().getMetrics();
		const charWidth = fontMetrics?.dimensions?.width || 0;
		const charHeight = fontMetrics?.dimensions?.height || 0;
		return { x: cellX * charWidth, y: cellY * charHeight };
	}

	public onExit(): void {
		this.startCell = null;
	}
	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent) {
		if (!this.startCell) return;

		const { clientX, clientY } = event;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const currentCell = this.worldToCellPos(worldPos.x, worldPos.y);

		const minX = Math.min(this.startCell.x, currentCell.x);
		const minY = Math.min(this.startCell.y, currentCell.y);
		const maxX = Math.max(this.startCell.x, currentCell.x);
		const maxY = Math.max(this.startCell.y, currentCell.y);

		const startWorld = this.cellToWorld(minX, minY);
		const endWorld = this.cellToWorld(maxX + 1, maxY + 1);

		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		activeSession.updateSelectedRegion({
			startX: startWorld.x,
			startY: startWorld.y,
			width: endWorld.x - startWorld.x,
			height: endWorld.y - startWorld.y
		});
	}

	public handleMouseUp(event: MouseEvent, context: SelectionModeContext): void {
		this.selectionRender.clear();
		if (!this.startCell) return;

		const { clientX, clientY } = event;
		const mousePos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const worldPos = this.camera.screenToWorld(mousePos.x, mousePos.y);

		const currentCell = this.worldToCellPos(worldPos.x, worldPos.y);

		const minX = Math.min(this.startCell.x, currentCell.x);
		const minY = Math.min(this.startCell.y, currentCell.y);
		const maxX = Math.max(this.startCell.x, currentCell.x);
		const maxY = Math.max(this.startCell.y, currentCell.y);

		const startWorld = this.cellToWorld(minX, minY);
		const endWorld = this.cellToWorld(maxX + 1, maxY + 1);

		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		let width = endWorld.x - startWorld.x;
		let height = endWorld.y - startWorld.y;
		const {
			dimensions: { width: charWidth, height: charHeight }
		} = this.coreApi.getFontManager().getMetrics();

		if (Math.abs(width) < charWidth) width = charWidth;
		if (Math.abs(height) < charHeight) height = charHeight;

		activeSession.updateSelectedRegion({
			startX: startWorld.x,
			startY: startWorld.y,
			width,
			height
		});
		context.transitionTo(SelectionModeName.SELECTED);
	}
}
