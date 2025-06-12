import { SelectionModeName, type ISelectionMode, type RotatingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import type { ICamera } from '@editor/types';
import { RotateSessionCommand } from '../session/commands/rotateSession.cmd';
import type { SelectionRenderer } from '../renderer/selection-renderer';
import type { SingleSessionSnapshot } from '../session/selection-session';
import type { CoreApi } from '@editor/core';

export class RotatingMode implements ISelectionMode<SelectionModeName.ROTATING> {
	readonly name = SelectionModeName.ROTATING;

	private readonly dotRadius: number = 4;
	private readonly hoveredDotRadius: number = 6;

	private readonly cornerOffset: number = 5;
	private readonly hitArea: number = 20;

	private camera: ICamera;

	private initialAngle: number = 0;
	private cumulativeRotation: number = 0;
	private lastAngle: number = 0;

	private fixedCenter: { cx: number; cy: number } | null = null;

	private hoveredCorner: number | null = null;
	private sessionBeforeRotate: SingleSessionSnapshot | null = null;
	private rotationAngle: number = 0;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager,
		private selectionRender: SelectionRenderer
	) {
		this.camera = this.coreApi.getCamera();
	}

	public getName(): string {
		return this.name;
	}

	public onEnter(_: SelectionModeContext, payload: RotatingModePayload): void {
		this.cleanup();
		this.sessionBeforeRotate = this.selectionSessionManager.serializeActiveSession()!;

		const {
			mouseDownEvent: { clientX, clientY }
		} = payload;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		this.startRotation({ x: pos.x, y: pos.y });
		this.selectionRender.triggerDraw();
	}

	public onExit(): void {
		this.cleanup();
		this.coreApi.getCursor().setCursor('default');
	}

	public cleanup() {
		this.rotationAngle = 0;
		this.fixedCenter = null;
		this.lastAngle = 0;
		this.initialAngle = 0;
		this.cumulativeRotation = 0;
		this.hoveredCorner = null;
	}

	public handleMouseDown(): void { }

	public handleMouseMove(event: MouseEvent) {
		const { clientX, clientY } = event;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		this.updateRotation({ x: pos.x, y: pos.y });
		this.selectionRender.triggerDraw();
	}

	public handleMouseUp(_: MouseEvent, context: SelectionModeContext): void {
		this.endRotation();
		this.selectionRender.triggerDraw();
		context.transitionTo(SelectionModeName.SELECTED);

		const sessionAfterRotate = this.selectionSessionManager.serializeActiveSession();
		this.coreApi.getHistoryManager().applyAction(
			{
				type: 'select::session_change',
				targetId: `select::session`,
				before: this.sessionBeforeRotate,
				after: sessionAfterRotate
			},
			{ applyAction: false }
		);
	}

	public startRotation(pos: { x: number; y: number }): void {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		const selectedContent = activeSession.getSelectedContent();
		if (selectedContent && selectedContent.data.trim().length === 1) return;

		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		this.initialAngle = this.calculateAngle(worldPos);
		this.coreApi.getCursor().setCursor('rotate', { angle: this.initialAngle });
		this.lastAngle = this.initialAngle;
		this.cumulativeRotation = 0;

		this.rotationAngle = this.cumulativeRotation;

		const selectedPoints = this.getSelectedContentToWorld();
		this.fixedCenter = this.computeCenter(selectedPoints);
	}

	public updateRotation(pos: { x: number; y: number }): void {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const currentAngle = this.calculateAngle(worldPos);

		this.coreApi.getCursor().setCursor('rotate', { angle: currentAngle });
		let angleDifference = currentAngle - this.lastAngle;
		if (angleDifference > 180) angleDifference -= 360;
		if (angleDifference < -180) angleDifference += 360;

		this.cumulativeRotation += angleDifference;
		this.lastAngle = currentAngle;

		this.rotationAngle = this.cumulativeRotation;
		const rotationThreshold = 90;

		if (Math.abs(this.cumulativeRotation) >= rotationThreshold) {
			const isClockwise = this.cumulativeRotation > 0;
			const rotationAngle = isClockwise ? 90 : -90;

			if (this.hoveredCorner !== null) {
				const cornerMap: { [x in number]: number } = isClockwise
					? {
						0: 3,
						3: 1,
						1: 2,
						2: 0
					}
					: {
						0: 2,
						2: 1,
						1: 3,
						3: 0
					};

				this.hoveredCorner = cornerMap[this.hoveredCorner];
			}

			if (isClockwise) {
				this.cumulativeRotation -= rotationThreshold;
			} else {
				this.cumulativeRotation += rotationThreshold;
			}
			this.selectionSessionManager.executeCommandOnActiveSession(
				new RotateSessionCommand(this.coreApi, rotationAngle, this.fixedCenter!)
			);
			this.coreApi.getRenderManager().requestRenderOnly('canvas', 'ascii');
			this.initialAngle = currentAngle;
			this.lastAngle = currentAngle;
		}
	}

	public endRotation(): void {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		this.cumulativeRotation = 0;
		this.rotationAngle = 0;
		this.fixedCenter = null;
	}

	private getSelectedContentToWorld(): { x: number; y: number; char: string }[] {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return [];

		const contentToWorld: { x: number; y: number; char: string }[] = [];

		const content = [activeSession.getSelectedContent()];
		content.forEach((content) => {
			const { data, region } = content!;
			const rows = data.split('\n');

			rows.forEach((row, rowIndex) => {
				row.split('').forEach((char, colIndex) => {
					if (char.trim()) {
						contentToWorld.push({
							x: region.startX + colIndex,
							y: region.startY + rowIndex,
							char
						});
					}
				});
			});
		});
		return contentToWorld;
	}

	private computeCenter(points: { x: number; y: number; char: string }[]): {
		cx: number;
		cy: number;
	} {
		const xValues = points.map((p) => p.x);
		const yValues = points.map((p) => p.y);

		const xMin = Math.min(...xValues);
		const xMax = Math.max(...xValues);
		const yMin = Math.min(...yValues);
		const yMax = Math.max(...yValues);

		const width = xMax - xMin + 1;
		const height = yMax - yMin + 1;

		const cx = width % 2 === 1 ? xMin + (width - 1) / 2 : xMin + width / 2 - 0.5;
		const cy = height % 2 === 1 ? yMin + (height - 1) / 2 : yMin + height / 2 - 0.5;

		this.fixedCenter = { cx, cy };
		return { cx, cy };
	}

	public isMouseNearCorner(pos: { x: number; y: number }): boolean {
		const activeSession = this.selectionSessionManager.getActiveSession();
		const selectedContent = activeSession?.getSelectedContent();

		if (
			!activeSession ||
			(selectedContent && selectedContent && selectedContent.data.trim().length === 1)
		) {
			this.hoveredCorner = null;
			return false;
		}

		const worldPos = this.camera.screenToWorld(pos.x, pos.y);
		const screenProximity = this.hitArea;
		const worldProximity = screenProximity / this.camera.scale;

		const screenOffset = this.cornerOffset;
		const worldOffset = screenOffset;

		const { startX, startY, width, height } = activeSession.getSelectedRegion()!;

		const offsetedStartX = startX - worldOffset;
		const offsetedStartY = startY - worldOffset;
		const offsetedEndX = startX + width + worldOffset;
		const offsetedEndY = startY + height + worldOffset;

		const corners = [
			{ x: offsetedStartX, y: offsetedStartY },
			{ x: offsetedEndX, y: offsetedEndY },
			{ x: offsetedStartX, y: offsetedEndY },
			{ x: offsetedEndX, y: offsetedStartY }
		];

		const cx = (startX + startX + width) / 2;
		const cy = (startY + startY + height) / 2;
		const rotationAngle = 0;

		const rotatedCorners = corners.map((corner) => {
			const dx = corner.x - cx;
			const dy = corner.y - cy;
			const angleRad = rotationAngle * (Math.PI / 180);
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);
			const rotatedX = dx * cos - dy * sin + cx;
			const rotatedY = dx * sin + dy * cos + cy;
			return { x: rotatedX, y: rotatedY };
		});

		let closestCornerIndex: number | null = null;
		let minDistanceSquared = Infinity;

		for (let i = 0; i < rotatedCorners.length; i++) {
			const corner = rotatedCorners[i];
			const dx = worldPos.x - corner.x;
			const dy = worldPos.y - corner.y;
			const distanceSquared = dx * dx + dy * dy;

			if (distanceSquared <= worldProximity * worldProximity) {
				if (distanceSquared < minDistanceSquared) {
					minDistanceSquared = distanceSquared;
					closestCornerIndex = i;
				}
			}
		}

		const previousHovered = this.hoveredCorner;
		this.hoveredCorner = closestCornerIndex;

		if (previousHovered !== this.hoveredCorner) {
			this.selectionRender.triggerDraw();
			if (this.hoveredCorner === null) this.coreApi.getCursor().setCursor('default');
		}

		if (this.hoveredCorner !== null) {
			const currentAngle = this.calculateAngle(worldPos);
			this.coreApi.getCursor().setCursor('rotate', { angle: currentAngle });
			return true;
		}

		return false;
	}

	private calculateAngle(worldPos: { x: number; y: number }): number {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return 0;

		const { startX, startY, width, height } = activeSession.getSelectedRegion()!;

		const centerX = startX + (startX + width - startX) / 2;
		const centerY = startY + (startY + height - startY) / 2;

		const deltaX = worldPos.x - centerX;
		const deltaY = worldPos.y - centerY;

		const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
		return angle < 0 ? angle + 360 : angle;
	}

	public getRotationAngle(): number {
		return this.rotationAngle;
	}

	public getCornerOffset(): number {
		return this.cornerOffset;
	}

	public getDotRadius(): number {
		return this.dotRadius;
	}

	public getHoveredDotRadius(): number {
		return this.hoveredDotRadius;
	}

	public getHoveredCorner(): number | null {
		return this.hoveredCorner;
	}
}
