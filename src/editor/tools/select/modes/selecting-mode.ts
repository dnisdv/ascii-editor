import { worldToCell } from '@editor/utils';
import { SelectionMode } from '@editor/select/selection-mode';
import { SelectionModeName, type ISelectionMode, type SelectingModePayload } from './modes.type';
import { createCellRectangle, type CellRectangle, type ICamera } from '@editor/types';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { SelectionRenderer } from '../renderer/selection-renderer';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';

export class SelectingMode implements ISelectionMode<SelectionModeName.SELECTING> {
	readonly name = SelectionModeName.SELECTING;
	private camera: ICamera;

	private startPoint: { x: number; y: number } | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager,
		private selectionRender: SelectionRenderer
	) {
		this.camera = coreApi.getCamera();
	}

	getName(): string {
		return this.name;
	}

	onEnter(_: SelectionModeContext, payload: SelectingModePayload): void {
		const {
			mouseDownEvent: { clientX, clientY }
		} = payload;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		this.startPoint = this.camera.screenToWorld(pos.x, pos.y);
		this.selectionRender.setSelectionRectangle({ ...this.startPoint, width: 0, height: 0 });
	}

	onExit(): void {
		this.startPoint = null;
		this.selectionRender.setSelectionRectangle(null);
	}

	handleMouseDown(): void {}

	handleMouseMove(event: MouseEvent) {
		if (this.startPoint === null) return;

		const { clientX, clientY } = event;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const endPoint = this.camera.screenToWorld(pos.x, pos.y);
		const currentRect = {
			x: this.startPoint.x,
			y: this.startPoint.y,
			width: endPoint.x - this.startPoint.x,
			height: endPoint.y - this.startPoint.y
		};
		this.selectionRender.setSelectionRectangle(currentRect);
	}

	handleMouseUp(event: MouseEvent, context: SelectionModeContext): void {
		const activeLayer = this.coreApi.getLayersManager().getActiveLayer();
		const selectionRect = this.selectionRender.selectionRect;

		if (!activeLayer || !selectionRect) {
			if (this.selectionManager.getActiveSession()) {
				this.selectionManager.commitSelection();
			}
			context.transitionTo(SelectionModeName.IDLE);
			return;
		}

		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;
		const cellStart = worldToCell({ charWidth, charHeight }, selectionRect.x, selectionRect.y);
		const cellEnd = worldToCell(
			{ charWidth, charHeight },
			selectionRect.x + selectionRect.width,
			selectionRect.y + selectionRect.height
		);

		const normalizedRect: CellRectangle = createCellRectangle({
			cellX: cellStart.x,
			cellY: cellStart.y,
			width: cellEnd.x - cellStart.x + 1,
			height: cellEnd.y - cellStart.y + 1
		});

		let selectionMode = SelectionMode.SET;
		if (event.shiftKey) {
			selectionMode = SelectionMode.ADD;
		} else if (event.ctrlKey) {
			selectionMode = SelectionMode.SUBTRACT;
		}

		const selectionMade = this.selectionManager.selectRegion(normalizedRect, selectionMode);

		if (selectionMade) {
			context.transitionTo(SelectionModeName.SELECTED);
		} else {
			context.transitionTo(SelectionModeName.IDLE);
		}
	}
}
