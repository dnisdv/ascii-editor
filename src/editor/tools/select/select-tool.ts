import { BaseTool } from '@editor/tool';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import { IdleMode } from './modes/idle-mode';
import { SelectedMode } from './modes/selected-mode';
import { MovingMode } from './modes/moving-mode';
import { SelectionModeName } from './modes/modes.type';
import { SelectionModeContext } from './modes/selection-mode-ctx';
import { SelectingMode } from './modes/selecting-mode';
import { SelectionRenderer } from './renderer/selection-renderer';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { ResizingMode } from './modes/resizing-mode';
import { AnchoringMode } from './modes/anchoring-mode';
import { RotatingMode } from './modes/rotating.mode';

export class SelectTool extends BaseTool {
	readonly name = 'select';
	private modeContext: SelectionModeContext;
	private selectionManager: SelectionManager;
	private selectionRenderer: SelectionRenderer;
	private _onSessionChanged = () => this.syncModeWithSelection();

	constructor(coreApi: CoreApi) {
		super({
			hotkey: '<A-v>',
			coreApi,
			name: 'select',
			isVisible: true,
			config: {},
			requirements: [RequireActiveLayerVisible(coreApi, 'select')]
		});

		this.coreApi = coreApi;
		this.selectionManager = coreApi.getSelectionManager();

		this.modeContext = new SelectionModeContext(coreApi, this.selectionManager);
		this.selectionRenderer = new SelectionRenderer(
			coreApi,
			this.selectionManager,
			this.modeContext
		);

		this.registerModes();
	}

	private registerModes(): void {
		this.modeContext.registerMode(SelectionModeName.IDLE, new IdleMode());
		this.modeContext.registerMode(
			SelectionModeName.SELECTING,
			new SelectingMode(this.coreApi, this.selectionManager, this.selectionRenderer)
		);
		this.modeContext.registerMode(
			SelectionModeName.SELECTED,
			new SelectedMode(this.coreApi, this.selectionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.MOVING,
			new MovingMode(this.coreApi, this.selectionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.RESIZING,
			new ResizingMode(this.coreApi, this.selectionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.ANCHORING,
			new AnchoringMode(this.coreApi, this.selectionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.ROTATING,
			new RotatingMode(this.coreApi, this.selectionManager)
		);
	}

	public activate(): void {
		super.activate();

		this.addMouseListeners();

		this.syncModeWithSelection();
		this.selectionManager.on('session::changed', this._onSessionChanged);
		this.selectionManager.on('session::committed', this._onSessionChanged);
		this.selectionManager.on('session::cancelled', this._onSessionChanged);
		this.selectionManager.on('manager::session_created', this._onSessionChanged);
		this.selectionManager.on('manager::session_destroyed', this._onSessionChanged);
		this.selectionManager.on('manager::session_change', this._onSessionChanged);
	}

	public deactivate(): void {
		super.deactivate();
		this.modeContext.cleanup();
		this.selectionRenderer.triggerDraw();
		this.getEventApi().removeToolEvents();

		this.selectionManager.off('session::changed', this._onSessionChanged);
		this.selectionManager.off('session::committed', this._onSessionChanged);
		this.selectionManager.off('session::cancelled', this._onSessionChanged);
		this.selectionManager.off('manager::session_created', this._onSessionChanged);
		this.selectionManager.off('manager::session_destroyed', this._onSessionChanged);
		this.selectionManager.off('manager::session_change', this._onSessionChanged);
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
		this.modeContext.setRestricted(true);
		this.modeContext.transitionTo(SelectionModeName.IDLE);
	}

	public onRequirementSuccess(): void {
		super.onRequirementSuccess();
		this.modeContext.setRestricted(false);
	}

	private addMouseListeners(): void {
		this.getEventApi().registerMouseDown('left', (e: MouseEvent) => {
			this.checkRequirements();
			this.modeContext.onMouseDown(e);
		});
		this.getEventApi().registerMouseMove((e: MouseEvent) => this.modeContext.onMouseMove(e));
		this.getEventApi().registerMouseUp((e: MouseEvent) => {
			this.modeContext.onMouseUp(e);
		});
	}

	private syncModeWithSelection(): void {
		const currentMode = this.modeContext.getCurrentModeName();
		const session = this.selectionManager.getActiveSession();
		if (!session || session.isEmpty()) {
			if (currentMode !== SelectionModeName.IDLE) {
				this.modeContext.transitionTo(SelectionModeName.IDLE);
			}
			return;
		}

		if (
			currentMode === SelectionModeName.ANCHORING ||
			currentMode === SelectionModeName.MOVING ||
			currentMode === SelectionModeName.RESIZING ||
			currentMode === SelectionModeName.ROTATING
		) {
			return;
		}

		if (currentMode !== SelectionModeName.SELECTED) {
			this.modeContext.transitionTo(SelectionModeName.SELECTED, { mouseEvent: undefined });
		}
	}
}
