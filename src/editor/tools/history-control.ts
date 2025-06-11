import type { CoreApi } from '@editor/core';
import { BaseTool, type ITool } from '../tool';
import type { HistoryManager } from '@editor/history-manager';

export class HistoryControlTool extends BaseTool implements ITool {
	readonly visible = false;
	private historyManager: HistoryManager;

	constructor(protected coreApi: CoreApi) {
		super({
			bus: coreApi.getBusManager(),
			name: 'history-control',
			isVisible: false,
			config: {},
			coreApi
		});
		this.historyManager = coreApi.getHistoryManager();

		this.historyManager.onAfterRedo(() => this.coreApi.render());
		this.historyManager.onAfterUndo(() => this.coreApi.render());

		this.getEventApi().registerKeyPress('<C-z>', this.handleUndo.bind(this), true);
		this.getEventApi().registerKeyPress('<C-S-Z>', this.handleRedo.bind(this), true);
		this.getEventApi().registerKeyPress('<C-y>', this.handleRedo.bind(this), true);
	}

	activate(): void {}
	deactivate(): void {}

	handleUndo() {
		this.historyManager.undo();
	}

	handleRedo() {
		this.historyManager.redo();
	}

	update(): void {
		this.coreApi.render();
	}
}
