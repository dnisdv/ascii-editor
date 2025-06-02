import type { ISessionManagerCommand } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { ILayersManager } from '@editor/types';
import type { CoreApi } from '@editor/core';

export class CommitSessionCommand implements ISessionManagerCommand {
	private historyManager: HistoryManager;
	private layersManager: ILayersManager;

	constructor(private coreApi: CoreApi) {
		this.historyManager = this.coreApi.getHistoryManager();
		this.layersManager = this.coreApi.getLayersManager();
	}

	public execute(_: CoreApi, manager: SelectionSessionManager): void {
		const beforeSession = manager.serializeActiveSession();

		const layer = this.layersManager.getLayer(String(beforeSession?.sourceLayerId));
		const selectedContent = beforeSession?.selectedContent;
		if (!layer || !selectedContent) return;

		const {
			region: { startX, startY, width, height }
		} = selectedContent;
		const beforeRegion = layer.readRegion(startX, startY, width, height);

		manager.commitActiveSession();

		this.historyManager.applyAction(
			{
				type: 'select::session_commit',
				targetId: `select::session`,
				before: {
					session: beforeSession,
					data: beforeRegion
				},
				after: {
					session: null,
					data: ''
				}
			},
			{ applyAction: false }
		);
	}
}
