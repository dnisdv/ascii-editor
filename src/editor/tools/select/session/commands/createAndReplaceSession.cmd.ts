import type { ISessionManagerCommand } from './type';
import type { SelectionSessionManager } from '../selection-session-manager';
import type { CoreApi } from '@editor/core';

export class CreateAndReplaceSessionCommand implements ISessionManagerCommand {
	public execute(_: CoreApi, manager: SelectionSessionManager): void {
		manager.commitActiveSession();
		const newSession = manager.createSession();
		manager.setActiveSession(newSession);
	}
}
