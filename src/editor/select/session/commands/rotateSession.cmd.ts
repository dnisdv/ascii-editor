import type { SelectionSession } from '../selection-session';
import type { ISessionCommand } from './type';
import type { HistoryManager } from '@editor/history-manager';

export type RotateDirection = 90 | -90 | 180 | -180 | 260 | -260 | 360 | -360;

export class RotateByCommand implements ISessionCommand {
	constructor(
		private deps: { historyManager: HistoryManager },
		private angle: RotateDirection,
		private options?: { recordHistory?: boolean }
	) {}

	public execute(session: SelectionSession): void {
		void session;
		throw new Error('Not implemented yet');
	}
}
