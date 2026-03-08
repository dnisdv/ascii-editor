import {
	HandlePosition,
	SelectionModeName,
	type ISelectionMode,
	type SelectedModePayload
} from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { CellRectangle, ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';
import type { ISmartObject, SmartObjectAnchor } from '@editor/objects/smart-object.interface';
import type { SelectionManager } from '@editor/select/selection-manager';
import { ResizingMode } from './resizing-mode';
import { cellToWorld } from '@editor/utils';

export class SelectedMode implements ISelectionMode<SelectionModeName.SELECTED> {
	readonly name = SelectionModeName.SELECTED;
	private camera: ICamera;
	private hoveredHandle: HandlePosition | null = null;
	private hoveredAnchor: { objectId: string; anchorId: string } | null = null;
	private isHoveringMoveArea: boolean = false;
	private readonly handleHitboxSize = 16;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
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

	private getCombinedBounds(objects: ISmartObject[]): CellRectangle | null {
		if (objects.length === 0) return null;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		objects.forEach((obj) => {
			minX = Math.min(minX, obj.getProperty('transform.x'));
			minY = Math.min(minY, obj.getProperty<number>('transform.y'));
			maxX = Math.max(
				maxX,
				obj.getProperty<number>('transform.x') + obj.getProperty<number>('transform.width')
			);
			maxY = Math.max(
				maxY,
				obj.getProperty<number>('transform.y') + obj.getProperty<number>('transform.height')
			);
		});

		return { cellX: minX, cellY: minY, width: maxX - minX, height: maxY - minY };
	}

	handleMouseDown(event: MouseEvent, context: SelectionModeContext): void {
		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		const resizingMode = context.getMode(SelectionModeName.RESIZING) as ResizingMode;
		const handle = resizingMode.getHandleAt(worldPos.x, worldPos.y);

		const hoveredAnchor = this.getAnchorAt(worldPos.x, worldPos.y);
		if (hoveredAnchor) {
			context.transitionTo(SelectionModeName.ANCHORING, {
				mouseDownEvent: event,
				objectId: hoveredAnchor.objectId,
				anchorId: hoveredAnchor.anchorId
			});
		} else if (handle !== null) {
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
		const newHoveredAnchor = this.getAnchorAt(worldPos.x, worldPos.y);

		const wasHoveringMove = this.isHoveringMoveArea;
		this.isHoveringMoveArea =
			this.isPointInsideMoveArea(worldPos.x, worldPos.y) && !newHoveredHandle && !newHoveredAnchor;

		if (wasHoveringMove !== this.isHoveringMoveArea) {
			this.coreApi.getRenderManager().requestRender();
		}

		if (
			newHoveredHandle !== this.hoveredHandle ||
			(newHoveredAnchor?.anchorId ?? null) !== (this.hoveredAnchor?.anchorId ?? null)
		) {
			this.hoveredHandle = newHoveredHandle;
			this.hoveredAnchor = newHoveredAnchor;
			this.coreApi.getRenderManager().requestRender();
		}

		const cursorName = this.hoveredAnchor
			? 'crosshair'
			: resizingMode.getCursorForHandle(this.hoveredHandle) ||
				(this.isHoveringMoveArea ? 'move' : 'default');

		this.coreApi.getCursor().setCursor(cursorName);
	}

	handleMouseUp(): void {}

	private isPointInsideMoveArea(worldX: number, worldY: number): boolean {
		const activeSession = this.selectionManager.getActiveSession();
		if (!activeSession || activeSession.isEmpty()) return false;

		const selected = activeSession.getSelectedObjects();
		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;

		if (selected.length === 1) {
			const cellX = Math.floor(worldX / charWidth);
			const cellY = Math.floor(worldY / charHeight);
			const obj = selected[0];
			if (typeof obj.hitTestMoveArea === 'function') return !!obj.hitTestMoveArea(cellX, cellY);
			if (typeof obj.hitTest === 'function') return !!obj.hitTest(cellX, cellY);

			const bounds = this.getCombinedBounds(selected);
			if (!bounds) return false;

			const startX = bounds.cellX * charWidth;
			const startY = bounds.cellY * charHeight;
			const width = bounds.width * charWidth;
			const height = bounds.height * charHeight;
			return (
				worldX >= startX &&
				worldX <= startX + width &&
				worldY >= startY &&
				worldY <= startY + height
			);
		}

		const bounds = this.getCombinedBounds(selected);
		if (!bounds) return false;

		const startX = bounds.cellX * charWidth;
		const startY = bounds.cellY * charHeight;
		const width = bounds.width * charWidth;
		const height = bounds.height * charHeight;

		const margin = this.handleHitboxSize / 2 / this.camera.scale;

		const innerLeft = startX + margin;
		const innerTop = startY + margin;
		const innerRight = startX + width - margin;
		const innerBottom = startY + height - margin;

		if (innerLeft > innerRight || innerTop > innerBottom) return true;

		return (
			worldX >= innerLeft && worldX <= innerRight && worldY >= innerTop && worldY <= innerBottom
		);
	}

	private getAnchorAt(
		worldX: number,
		worldY: number
	): { objectId: string; anchorId: string } | null {
		const session = this.selectionManager.getActiveSession();
		if (!session) return null;

		const objs = session.getSelectedObjects();
		if (objs.length === 0) return null;

		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;
		const radius = this.handleHitboxSize / 2 / this.camera.scale;

		for (const obj of objs) {
			if (!obj.getAnchors) continue;
			const anchors: SmartObjectAnchor[] = obj.getAnchors();
			for (const a of anchors) {
				const world = cellToWorld({ charWidth, charHeight, cellX: a.x, cellY: a.y });
				const cx = worldX - (world.x + charWidth / 2);
				const cy = worldY - (world.y + charHeight / 2);
				const dist = Math.hypot(cx, cy);
				if (dist <= radius) {
					return { objectId: obj.id, anchorId: a.id };
				}
			}
		}
		return null;
	}
}
