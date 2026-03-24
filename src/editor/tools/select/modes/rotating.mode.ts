import { SelectionModeName, type ISelectionMode, type RotatingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { ICamera } from '@editor/types';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { cellToWorld } from '@editor/utils';
import {
	isRotatable,
	type ISmartObject,
	type IRotatable
} from '@editor/objects/smart-object.interface';
import {
	objectRotationPatch,
	type ObjectRotationPatchAction,
	type RotationState
} from '@editor/objects/history/object-rotation-patch';

function captureState(obj: ISmartObject & IRotatable): RotationState {
	return {
		x: obj.getCommittedProperty<number>('transform.x'),
		y: obj.getCommittedProperty<number>('transform.y'),
		width: obj.getCommittedProperty<number>('transform.width'),
		height: obj.getCommittedProperty<number>('transform.height'),
		content: obj.getRotationContent?.()
	};
}

function restoreState(obj: ISmartObject & IRotatable, state: RotationState): void {
	obj.properties.applyCommitted('transform.x', state.x);
	obj.properties.applyCommitted('transform.y', state.y);
	obj.properties.applyCommitted('transform.width', state.width);
	obj.properties.applyCommitted('transform.height', state.height);
	if (state.content !== undefined) obj.restoreRotationContent?.(state.content);
	obj.emit?.('update');
}

export class RotatingMode implements ISelectionMode<SelectionModeName.ROTATING> {
	readonly name = SelectionModeName.ROTATING;

	readonly hitArea: number = 20;
	private readonly snapThreshold: number = 15;

	private camera: ICamera;
	private center: { x: number; y: number } | null = null;
	private lastMouseAngle: number = 0;

	private accumulatedAngle: number = 0;
	private lastSnapTotal: number = 0;

	private initialStates: Map<string, RotationState> = new Map();
	private rotatableObjects: (ISmartObject & IRotatable)[] = [];
	private committed: boolean = false;

	private cursorRafId: number | null = null;
	private pendingCursorAngle: number = 0;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
	) {
		this.camera = this.coreApi.getCamera();
	}

	public getName(): string {
		return this.name;
	}

	public getRotationHandlePositions(): Array<{ x: number; y: number }> | null {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return null;

		const objects = session.getSelectedObjects();
		if (objects.length !== 1 || !objects[0].capabilities.canRotate) return null;

		const { width: charWidth, height: charHeight } =
			this.coreApi.getFontManager().getMetrics().dimensions;

		return this.rotationAnchorsToWorld(objects[0], charWidth, charHeight);
	}

	private rotationAnchorsToWorld(
		obj: ISmartObject,
		charWidth: number,
		charHeight: number
	): Array<{ x: number; y: number }> | null {
		const anchors = obj.getRotationAnchors?.(charWidth, charHeight);
		if (!anchors || anchors.length === 0) return null;

		return anchors.map((a) => ({
			x: a.x * charWidth + (a.screenOffset?.x ?? 0) / this.camera.scale,
			y: a.y * charHeight + (a.screenOffset?.y ?? 0) / this.camera.scale
		}));
	}

	public getRotationHandleAt(worldX: number, worldY: number): number | null {
		const positions = this.getRotationHandlePositions();
		if (!positions) return null;

		const hitRadius = this.hitArea / 2 / this.camera.scale;

		for (let i = 0; i < positions.length; i++) {
			const dist = Math.hypot(worldX - positions[i].x, worldY - positions[i].y);
			if (dist <= hitRadius) return i;
		}
		return null;
	}

	private getRelativeAngle(): number {
		return this.accumulatedAngle - this.lastSnapTotal;
	}

	public getDisplayAngle(): number {
		const rel = this.getRelativeAngle();
		const snapZone = 90 - this.snapThreshold;
		if (rel > snapZone) return 90;
		if (rel < -snapZone) return -90;
		return rel;
	}

	public getDisplayHandlePositions(): Array<{ x: number; y: number }> | null {
		const displayAngle = this.getDisplayAngle();

		if (displayAngle % 90 === 0) {
			return this.getRotationHandlePositions();
		}

		const origPositions = this.getRotationHandlePositions();
		const center = this.getBoundingBoxCenterWorld();
		if (!origPositions || !center) return origPositions;

		const rad = (displayAngle * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const { x: cx, y: cy } = center;

		return origPositions.map(({ x, y }) => {
			const dx = x - cx;
			const dy = y - cy;
			return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
		});
	}

	public getHandleAngle(handleIndex: number): number {
		const positions = this.getRotationHandlePositions();
		if (!positions || handleIndex < 0 || handleIndex >= positions.length) return 0;
		const center = this.getBoundingBoxCenterWorld();
		if (!center) return 0;
		const pos = positions[handleIndex];
		return Math.atan2(pos.y - center.y, pos.x - center.x) * (180 / Math.PI);
	}

	private getBoundingBoxCenterWorld(): { x: number; y: number } | null {
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) return null;

		const { cellX, cellY, width, height } = session.boundingBox;
		const { width: charWidth, height: charHeight } =
			this.coreApi.getFontManager().getMetrics().dimensions;

		const bbStart = cellToWorld({ charWidth, charHeight, cellX, cellY });
		const bbEnd = cellToWorld({
			charWidth,
			charHeight,
			cellX: cellX + width,
			cellY: cellY + height
		});

		return { x: (bbStart.x + bbEnd.x) / 2, y: (bbStart.y + bbEnd.y) / 2 };
	}

	public onEnter(_ctx: SelectionModeContext, payload: RotatingModePayload): void {
		const { mouseDownEvent } = payload;
		this.center = this.getBoundingBoxCenterWorld();
		this.accumulatedAngle = 0;
		this.lastSnapTotal = 0;
		this.committed = false;
		this.initialStates.clear();

		const session = this.selectionManager.getActiveSession();
		if (session) {
			const objs = session
				.getSelectedObjects()
				.filter((o) => o.capabilities.canRotate && isRotatable(o));
			this.rotatableObjects = objs as (ISmartObject & IRotatable)[];
			for (const obj of this.rotatableObjects) {
				this.initialStates.set(obj.id, captureState(obj));
			}
		}

		if (this.center) {
			const pos = this.camera.getMousePosition({
				x: mouseDownEvent.clientX,
				y: mouseDownEvent.clientY
			});
			const worldPos = this.camera.screenToWorld(pos.x, pos.y);
			this.lastMouseAngle =
				Math.atan2(worldPos.y - this.center.y, worldPos.x - this.center.x) * (180 / Math.PI);
		}

		this.scheduleCursorUpdate(this.lastMouseAngle);
	}

	public onExit(): void {
		this.cancelCursorRaf();

		if (!this.committed && this.lastSnapTotal !== 0) {
			for (const obj of this.rotatableObjects) {
				const state = this.initialStates.get(obj.id);
				if (state) restoreState(obj, state);
			}
			const session = this.selectionManager.getActiveSession();
			session?.recalculateBoundingBox();
		}

		this.initialStates.clear();
		this.rotatableObjects = [];
		this.lastSnapTotal = 0;
		this.committed = false;
		this.center = null;
		this.accumulatedAngle = 0;
		this.coreApi.getCursor().setCursor('default');
	}

	private scheduleCursorUpdate(angle: number): void {
		this.pendingCursorAngle = angle;
		if (this.cursorRafId !== null) return;
		this.cursorRafId = requestAnimationFrame(() => {
			this.cursorRafId = null;
			this.coreApi.getCursor().setCursor('rotate', { angle: this.pendingCursorAngle });
		});
	}

	private cancelCursorRaf(): void {
		if (this.cursorRafId !== null) {
			cancelAnimationFrame(this.cursorRafId);
			this.cursorRafId = null;
		}
	}

	public cleanup(): void {}

	public handleMouseDown(): void {}

	public handleMouseMove(event: MouseEvent): void {
		if (!this.center) return;

		const pos = this.camera.getMousePosition({ x: event.clientX, y: event.clientY });
		const worldPos = this.camera.screenToWorld(pos.x, pos.y);

		const mouseAngle =
			Math.atan2(worldPos.y - this.center.y, worldPos.x - this.center.x) * (180 / Math.PI);

		let delta = mouseAngle - this.lastMouseAngle;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;

		this.accumulatedAngle += delta;
		this.lastMouseAngle = mouseAngle;

		this.scheduleCursorUpdate(mouseAngle);

		const display = this.getDisplayAngle();

		if (display === 90) {
			for (const obj of this.rotatableObjects) {
				obj.applyRotation(90);
			}
			this.lastSnapTotal += 90;
			const session = this.selectionManager.getActiveSession();
			session?.recalculateBoundingBox();
		} else if (display === -90) {
			for (const obj of this.rotatableObjects) {
				obj.applyRotation(-90);
			}
			this.lastSnapTotal -= 90;
			const session = this.selectionManager.getActiveSession();
			session?.recalculateBoundingBox();
		}

		this.coreApi.getRenderManager().requestRender();
	}

	public handleMouseUp(_event: MouseEvent, context: SelectionModeContext): void {
		const netAngle = ((this.lastSnapTotal % 360) + 360) % 360;

		if (netAngle !== 0) {
			const historyManager = this.coreApi.getHistoryManager();
			const session = this.selectionManager.getActiveSession();

			for (const obj of this.rotatableObjects) {
				const before = this.initialStates.get(obj.id);
				if (!before) continue;
				const after = captureState(obj);
				const action: ObjectRotationPatchAction = {
					type: objectRotationPatch.type,
					targetId: obj.id,
					before,
					after
				};
				historyManager.applyAction(action, { applyAction: false });
			}

			session?.recalculateBoundingBox();
		}

		this.committed = true;
		context.transitionTo(SelectionModeName.SELECTED);
	}
}
