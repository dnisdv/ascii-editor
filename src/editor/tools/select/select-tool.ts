import type { BaseAction, HistoryManager } from '@editor/history-manager';
import { BaseTool } from '@editor/tool';
import { RequireActiveLayerVisible } from '@editor/tool-requirements';
import { IdleMode } from './modes/idle-mode';
import { SelectedMode } from './modes/selected-mode';
import { MovingMode } from './modes/moving-mode';
import { RotatingMode } from './modes/rotating.mode';
import { SelectionModeName } from './modes/modes.type';
import { SelectionModeContext } from './modes/selection-mode-ctx';
import { SelectingMode } from './modes/selecting-mode';
import { SelectionRenderer } from './renderer/selection-renderer';
import { SelectionSessionManager } from './session/selection-session-manager';
import { SelectSession } from './history/session-select';
import { SelectSessionCancel } from './history/session-cancel';
import { SelectSessionChange } from './history/session-change';
import { SelectSessionCommit } from './history/session-commit';
import { CommitSessionCommand } from './session/commands/commitSession.cmd';
import { CancelSessionCommand } from './session/commands/cancelSession.cmd';
import { sessionManagerApi } from './tool-export-api';
import type { CoreApi } from '@editor/core';
import type { LayerRemoveAndActivateAction } from '@editor/layers/history/layer-remove-and-activate';

export type SelectToolApi = ReturnType<typeof sessionManagerApi>;

export class SelectTool extends BaseTool {
	readonly name = 'select';
	private modeContext: SelectionModeContext;
	private selectionSessionManager: SelectionSessionManager;

	private selectionRenderer: SelectionRenderer;
	private historyManager: HistoryManager;

	constructor(coreApi: CoreApi) {
		super({
			hotkey: '<A-v>',
			bus: coreApi.getBusManager(),
			coreApi,
			name: 'select',
			isVisible: true,
			config: {},
			requirements: [RequireActiveLayerVisible(coreApi, 'select')]
		});

		this.coreApi = coreApi;
		this.historyManager = coreApi.getHistoryManager();

		this.selectionSessionManager = new SelectionSessionManager(this.coreApi);

		this.modeContext = new SelectionModeContext(coreApi, this.selectionSessionManager);
		this.selectionRenderer = new SelectionRenderer(
			coreApi,
			this.selectionSessionManager,
			this.modeContext
		);

		this.historyManager.registerHandler('select::session_select', new SelectSession());
		this.historyManager.registerHandler('select::session_cancel', new SelectSessionCancel());
		this.historyManager.registerHandler('select::session_commit', new SelectSessionCommit());
		this.historyManager.registerHandler('select::session_change', new SelectSessionChange());
		this.historyManager.registerTarget('select::session', this.selectionSessionManager);

		this.registerModes();

		this.selectionSessionManager.on('session::content_updated', () => {
			if (this.modeContext.getCurrentMode().getName() === SelectionModeName.IDLE) {
				this.modeContext.transitionTo(SelectionModeName.SELECTED);
			}
		});

		this.historyManager.onBeforeApplyActionSubscriber((action) =>
			this.handleBeforeHistoryChange(action)
		);
	}

	private handleBeforeHistoryChange(action: BaseAction): void {
		const activeSession = this.selectionSessionManager.getActiveSession();

		if (!activeSession || activeSession.isEmpty() || action.type.startsWith('select::')) {
			return;
		}

		const activeSessionSourceLayerId = activeSession.getSourceLayerId();

		// TODO: add metadata for history for handling situations like that instead of concrete one actions inspecting
		switch (action.type) {
			case 'layers::change::active':
			case 'layers::create_and_activate':
				this.handleCommitAndExit();
				break;

			case 'layers::remove_and_activate': {
				const removeAction = action as LayerRemoveAndActivateAction;
				if (removeAction.before.layer.id === activeSessionSourceLayerId) {
					this.handleCommitAndExit();
				}
				break;
			}

			case 'layer::set_chars':
			case 'layer::set_region': {
				if (action.targetId === `layer::${activeSessionSourceLayerId}`) {
					this.handleCommitAndExit();
				}
				break;
			}
		}
	}

	private handleCommitAndExit(): void {
		this.selectionSessionManager.executeCommand(new CommitSessionCommand(this.coreApi));
		this.modeContext.cleanup();
		this.modeContext.transitionTo(SelectionModeName.IDLE);
		this.selectionRenderer.clear();
	}

	private registerModes(): void {
		this.modeContext.registerMode(SelectionModeName.IDLE, new IdleMode());
		this.modeContext.registerMode(
			SelectionModeName.SELECTING,
			new SelectingMode(this.coreApi, this.selectionSessionManager, this.selectionRenderer)
		);
		this.modeContext.registerMode(
			SelectionModeName.SELECTED,
			new SelectedMode(this.coreApi, this.selectionSessionManager)
		);
		this.modeContext.registerMode(
			SelectionModeName.MOVING,
			new MovingMode(this.coreApi, this.selectionSessionManager, this.selectionRenderer)
		);
		this.modeContext.registerMode(
			SelectionModeName.ROTATING,
			new RotatingMode(this.coreApi, this.selectionSessionManager, this.selectionRenderer)
		);
	}

	public getApi(): SelectToolApi {
		return {
			...sessionManagerApi(this.coreApi, this.selectionSessionManager)
		};
	}

	public activate(): void {
		super.activate();

		this.addMouseListeners();
		this.initKeyListener();
	}

	public deactivate(): void {
		super.deactivate();
		this.modeContext.cleanup();
		this.selectionRenderer.triggerDraw();
		this.getEventApi().removeToolEvents();
	}

	public onRequirementFailure(): void {
		super.onRequirementFailure();
		this.modeContext.setRestricted(true);
		this.modeContext.transitionTo(SelectionModeName.IDLE);
		this.selectionSessionManager.executeCommand(new CommitSessionCommand(this.coreApi));
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

	private initKeyListener(): void {
		this.getEventApi().registerUnload(this.handleUnloadPage.bind(this));

		this.getEventApi().registerKeyPress('<Backspace>', this.handleDeleteSelected.bind(this));
		this.getEventApi().registerKeyPress('<Delete>', this.handleDeleteSelected.bind(this));
		this.getEventApi().registerKeyPress('<Escape>', this.handleCommitSession.bind(this));
	}

	private handleUnloadPage() {
		this.selectionSessionManager.executeCommand(new CommitSessionCommand(this.coreApi));
	}

	private handleCommitSession() {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession || !activeSession.getSelectedContent()?.data) return;
		this.selectionSessionManager.executeCommand(new CommitSessionCommand(this.coreApi));
		this.modeContext.cleanup();
		this.modeContext.transitionTo(SelectionModeName.IDLE);
		this.coreApi.getRenderManager().requestRender();
		this.selectionRenderer.clear();
	}

	private handleDeleteSelected() {
		const activeSession = this.selectionSessionManager.getActiveSession();
		if (!activeSession || !activeSession.getSelectedContent()?.data) return;
		this.selectionSessionManager.executeCommand(new CancelSessionCommand(this.coreApi));
		this.modeContext.cleanup();
		this.modeContext.transitionTo(SelectionModeName.IDLE);
		this.coreApi.getRenderManager().requestRender();
		this.selectionRenderer.clear();
	}
}
