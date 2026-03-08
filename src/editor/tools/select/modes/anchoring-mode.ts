import type { ISelectionMode } from './modes.type';
import { SelectionModeName, type AnchoringModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { worldToCell } from '@editor/utils';
import { commitAnchorsChange } from '@editor/objects/object-commands';

export class AnchoringMode implements ISelectionMode<SelectionModeName.ANCHORING> {
	readonly name = SelectionModeName.ANCHORING;
	private anchorId: string | null = null;
	private objectId: string | null = null;
	private beforeAnchors: Array<{ x: number; y: number }> | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
	) {}

	getName(): string {
		return this.name;
	}

	onEnter(_: SelectionModeContext, payload?: AnchoringModePayload): void {
		this.anchorId = payload?.anchorId ?? null;
		this.objectId = payload?.objectId ?? null;
		this.coreApi.getCursor().setCursor('crosshair');

		if (this.objectId) {
			const session = this.selectionManager.getActiveSession();
			const obj = session?.getObjectById(this.objectId);
			if (obj && obj.getAnchors) {
				const anchors = obj.getAnchors();
				this.beforeAnchors = anchors.map((a) => ({ x: a.x, y: a.y }));
			} else {
				this.beforeAnchors = null;
			}
		} else {
			this.beforeAnchors = null;
		}
	}

	onExit(): void {
		this.anchorId = null;
		this.objectId = null;
		this.coreApi.getCursor().setCursor('default');
	}

	handleMouseDown(): void {}

	handleMouseMove(event: MouseEvent): void {
		if (!this.anchorId || !this.objectId) return;

		const session = this.selectionManager.getActiveSession();
		if (!session) return;

		const obj = session.getObjectById(this.objectId);
		if (!obj || !obj.moveAnchor) return;

		const { width: charWidth, height: charHeight } = this.coreApi
			.getFontManager()
			.getMetrics().dimensions;
		const pos = this.coreApi.getCamera().getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.coreApi.getCamera().screenToWorld(pos.x, pos.y);
		const cell = worldToCell({ charWidth, charHeight }, worldPos.x, worldPos.y);

		obj.moveAnchor(this.anchorId, cell.x, cell.y);
		this.coreApi.getRenderManager().requestRender();
	}

	handleMouseUp(e: MouseEvent, ctx: SelectionModeContext): void {
		const before = this.beforeAnchors;
		this.beforeAnchors = null;

		const session = this.selectionManager.getActiveSession();
		if (!this.objectId || !session) {
			ctx.transitionTo(SelectionModeName.SELECTED, { mouseEvent: e });
			return;
		}

		const obj = session.getObjectById(this.objectId);
		if (!obj || !obj.getAnchors) {
			ctx.transitionTo(SelectionModeName.SELECTED, { mouseEvent: e });
			return;
		}

		const after = obj.getAnchors().map((a) => ({ x: a.x, y: a.y }));

		if (!before) {
			ctx.transitionTo(SelectionModeName.SELECTED, { mouseEvent: e });
			return;
		}

		const minLen = Math.min(before.length, after.length);
		const coordsChanged = Array.from({ length: minLen }).some(
			(_, i) => after[i].x !== before[i].x || after[i].y !== before[i].y
		);
		const lengthChanged = before.length !== after.length;
		const changed = lengthChanged || coordsChanged;
		if (changed) commitAnchorsChange(this.coreApi.getHistoryManager(), obj, before, after);
		ctx.transitionTo(SelectionModeName.SELECTED, { mouseEvent: e });
	}
}
