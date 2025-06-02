import { CreateSessionWithContentCommand } from './session/commands/selectContent.cmd';
import type { SelectionSessionManager } from './session/selection-session-manager';
import { CancelSessionCommand } from './session/commands/cancelSession.cmd';
import type { CoreApi } from '@editor/core';

export const sessionManagerApi = (coreApi: CoreApi, manager: SelectionSessionManager) => ({
	cancelActiveSession: () => {
		manager.executeCommand(new CancelSessionCommand(coreApi));
	},
	createSessionWithContent: (
		region: { startX: number; startY: number; width: number; height: number },
		data: string,
		sourceLayerId: string | null = null
	) => {
		manager.executeCommand(
			new CreateSessionWithContentCommand(coreApi, region, data, sourceLayerId)
		);
	},
	getActiveSession: () => {
		return manager.getActiveSession();
	}
});
