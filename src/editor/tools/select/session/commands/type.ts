import type { CoreApi } from '@editor/core';
import type { SingleSelectSession } from '../selection-session';
import type { SelectionSessionManager } from '../selection-session-manager';

export interface ISessionCommand {
	execute(
		session: SingleSelectSession,
		coreApi: CoreApi,
		manager: SelectionSessionManager
	): Promise<void> | void;
}

export interface ISessionManagerCommand {
	execute(coreApi: CoreApi, manager: SelectionSessionManager): Promise<void> | void;
}
