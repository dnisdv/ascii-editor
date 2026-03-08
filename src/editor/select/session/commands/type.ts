import type { SelectionSessionManager } from '../selection-session-manager';
import type { SelectionSession } from '../selection-session';
import type { Config } from '@editor/config';
import type { FontManager } from '@editor/font-manager';
import type { HistoryManager } from '@editor/history-manager';
import type { LayersManager } from '@editor/layers/layers-manager';

export type ISessionCommandDeps = {
	layersManager: LayersManager;
	fontManager: FontManager;
	config: Config;
	historyManager: HistoryManager;
};

export type ISessionManagerCommandDeps = ISessionCommandDeps;
export interface ISessionCommand {
	execute(
		session: SelectionSession,
		deps: ISessionCommandDeps,
		manager: SelectionSessionManager
	): Promise<void> | void;
}

export interface ISessionManagerCommand {
	execute(deps: ISessionCommandDeps, manager: SelectionSessionManager): Promise<void> | void;
}
