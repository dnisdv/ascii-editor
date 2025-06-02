import type { ISessionManagerCommand } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { CoreApi } from '@editor/core';

export class CancelSessionCommand implements ISessionManagerCommand {
	private historyManager: HistoryManager;

	constructor(private coreApi: CoreApi) {
		this.historyManager = this.coreApi.getHistoryManager();
	}

	public execute(_: CoreApi, manager: SelectionSessionManager): void {
		const sessionBeforeCancel = manager.serializeActiveSession();
		manager.cancelActiveSession();

		this.historyManager.applyAction(
			{
				type: 'select::session_cancel',
				targetId: `select::session`,
				before: {
					session: sessionBeforeCancel
				},
				after: {
					session: null
				}
			},
			{ applyAction: false }
		);
	}
}
