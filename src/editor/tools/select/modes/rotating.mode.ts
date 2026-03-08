import { SelectionModeName, type ISelectionMode } from './modes.type';
import type { SelectionSessionManager } from '@editor/select/session/selection-session-manager';
import type { ICamera } from '@editor/types';
import type { SelectionRenderer } from '../renderer/selection-renderer';
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

	public onEnter(): void {}

	public onExit(): void {}

	public cleanup() {}

	public handleMouseDown(): void {}

	public handleMouseMove() {}

	public handleMouseUp(): void {}
}
