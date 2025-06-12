import { SelectionModeName, type ISelectionMode, type SelectingModePayload } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';
import type { ICamera } from '@editor/types';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import { PopulateRegionCommand } from '../session/commands/populateRegion.cmd';
import { CommitSessionCommand } from '../session/commands/commitSession.cmd';
import { CreateAndReplaceSessionCommand } from '../session/commands/createAndReplaceSession.cmd';
import type { SelectionRenderer } from '../renderer/selection-renderer';
import type { CoreApi } from '@editor/core';

export class SelectingMode implements ISelectionMode<SelectionModeName.SELECTING> {
	readonly name = SelectionModeName.SELECTING;
	private camera: ICamera;

	private startPoint: { x: number; y: number } | null = null;

	constructor(
		private coreApi: CoreApi,
		private selectionSessionManager: SelectionSessionManager,
		private selectionRender: SelectionRenderer
	) {
		this.camera = coreApi.getCamera();
	}

	getName(): string {
		return this.name;
	}

	onEnter(_: SelectionModeContext, payload: SelectingModePayload): void {
		this.selectionSessionManager.executeCommand(new CommitSessionCommand(this.coreApi));

		const {
			mouseDownEvent: { clientX, clientY }
		} = payload;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		this.startPoint = this.camera.screenToWorld(pos.x, pos.y);

		this.selectionSessionManager.executeCommand(new CreateAndReplaceSessionCommand());
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (activeSession) {
			activeSession.updateSelectedRegion({
				startX: this.startPoint.x,
				startY: this.startPoint.y,
				width: 0,
				height: 0
			});
		}
	}
	onExit(): void { }
	handleMouseDown(): void { }

	handleMouseMove(event: MouseEvent) {
		if (this.startPoint === null) return;

		const { clientX, clientY } = event;
		const pos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const endPoint = this.camera.screenToWorld(pos.x, pos.y);

		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession) return;

		activeSession.updateSelectedRegion({
			startX: this.startPoint.x,
			startY: this.startPoint.y,
			width: endPoint.x - this.startPoint.x,
			height: endPoint.y - this.startPoint.y
		});
	}


	handleMouseUp(event: MouseEvent, context: SelectionModeContext): void {
		this.selectionRender.clear();

		if (context.isRestrictedMode()) {
			context.transitionTo(SelectionModeName.IDLE);
			return;
		}

		this.selectionSessionManager.executeCommand(new CreateAndReplaceSessionCommand());

		const { clientX, clientY } = event;
		const mousePos = this.camera.getMousePosition({ x: clientX, y: clientY });
		const endPoint = this.camera.screenToWorld(mousePos.x, mousePos.y);
		const layerId = this.coreApi.getLayersManager().getActiveLayer()?.id;

		this.selectionSessionManager.executeCommandOnActiveSession(
			new PopulateRegionCommand(
				this.coreApi,
				{
					x: this.startPoint!.x,
					y: this.startPoint!.y,
					width: endPoint.x - this.startPoint!.x,
					height: endPoint.y - this.startPoint!.y
				},
				layerId!
			)
		);

		const activeSession = this.selectionSessionManager.getActiveSession();

		if (activeSession?.isEmpty()) {
			context.transitionTo(SelectionModeName.IDLE);
			return;
		}

		context.transitionTo(SelectionModeName.SELECTED);
	}
}
