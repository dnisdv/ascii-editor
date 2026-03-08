import { EventEmitter } from '@editor/event-emitter';
import { SelectionSession, type SessionEventType, type SessionSnapshot } from './selection-session';
import type { ISessionCommand, ISessionManagerCommand } from './commands/type';
import type { FontManager } from '@editor/font-manager';
import type { Config } from '@editor/config';
import type { LayersManager } from '@editor/layers/layers-manager';
import { HistoryManager } from '@editor/history-manager';
import { SessionSelect, sessionSelect } from '../history/session-select';
import { SessionCommit, sessionCommit } from '../history/session-commit';
import { SessionChange, sessionChange } from '../history/session-change';
import { SessionRemove, sessionRemove } from '../history/session-remove';
import { SessionSubtractRegion, sessionSubtractRegion } from '../history/session-subtract-region';
import { SessionDeselect, sessionDeselect } from '../history/session-deselect';
import { SessionAppendRegion, sessionAppendRegion } from '../history/session-append-region';
import { SessionAppendObjects, sessionAppendObjects } from '../history/session-append-objects';
import type { SessionExecutionContext } from '../history/history-context';
import { SmartObjectsManager } from '@editor/smart-objects-manager';

export type ManagerEventType = SessionEventType & {
	'manager::session_created': undefined;
	'manager::session_destroyed': undefined;
	'manager::session_change': undefined;
};

export const historyTargetSessionManager = 'select::session';
export const historyTargetActiveSession = 'select::active_session';

type SelectionSessionManagerDependencies = {
	layersManager: LayersManager;
	fontManager: FontManager;
	historyManager: HistoryManager;
	config: Config;
	smartObjectsManager: SmartObjectsManager;
};

export class SelectionSessionManager extends EventEmitter<ManagerEventType> {
	private currentSession: SelectionSession | null = null;

	private layersManager: LayersManager;
	private fontManager: FontManager;
	private historyManager: HistoryManager;
	private config: Config;
	private smartObjectsManager: SmartObjectsManager;

	constructor({
		layersManager,
		fontManager,
		config,
		historyManager,
		smartObjectsManager
	}: SelectionSessionManagerDependencies) {
		super();
		this.layersManager = layersManager;
		this.fontManager = fontManager;
		this.config = config;
		this.historyManager = historyManager;
		this.smartObjectsManager = smartObjectsManager;

		this.historyManager.registerTarget('select::session', this);

		this.registerHistoryContext();
		this.registerHistoryHandlers();

		this.layersManager.on('layer::active::changed', ({ oldId, newId }) =>
			this.handleLayerChange(oldId, newId)
		);
		this.layersManager.on('layer::updated', (payload) => this.handleLayerUpdate(payload));
	}

	public handleLayerUpdate(payload: { layerId?: string; opts?: { visible?: boolean } }): void {
		const activeSession = this.getActiveSession();
		if (!activeSession) return;

		const sessionSourceId = activeSession.getSourceLayerId();
		if (sessionSourceId && payload.layerId === sessionSourceId) {
			if (payload.opts?.visible === false) {
				try {
					this.historyManager.execute(sessionCommit, 'select::session');
				} catch (e) {
					console.warn('Auto-commit on layer hide failed:', e);
				}
			}
		}
	}

	public handleLayerChange(oldId: string | null, newId: string | null): void {
		const activeSession = this.getActiveSession();
		if (!activeSession) return;

		const sessionSourceId = activeSession.getSourceLayerId();
		if (sessionSourceId && oldId === sessionSourceId && newId !== oldId) {
			try {
				this.historyManager.execute(sessionCommit, 'select::session');
			} catch (e) {
				console.warn('Auto-commit on layer switch failed:', e);
			}
		}
	}

	private registerHistoryContext(): void {
		const executionContext: SessionExecutionContext = {};
		this.historyManager.registerContext('select::session', executionContext);
	}

	private registerHistoryHandlers(): void {
		this.historyManager.registerHandler(sessionCommit, new SessionCommit());
		this.historyManager.registerHandler(sessionChange, new SessionChange());
		this.historyManager.registerHandler(sessionSelect, new SessionSelect());
		this.historyManager.registerHandler(sessionSubtractRegion, new SessionSubtractRegion());
		this.historyManager.registerHandler(sessionDeselect, new SessionDeselect());
		this.historyManager.registerHandler(sessionAppendRegion, new SessionAppendRegion());
		this.historyManager.registerHandler(sessionAppendObjects, new SessionAppendObjects());
		this.historyManager.registerHandler(sessionRemove, new SessionRemove());
	}

	private clearProxiedSessionListeners(): void {
		if (this.currentSession) {
			this.unproxy(this.currentSession);
		}
	}

	private setupEventProxyForSession(session: SelectionSession): void {
		this.clearProxiedSessionListeners();

		const eventsToProxy: (keyof SessionEventType)[] = [
			'session::committed',
			'session::cancelled',
			'session::changed'
		];
		this.proxy(session, { events: eventsToProxy });
	}

	public setActiveSession(newSession: SelectionSession) {
		this.currentSession = newSession;
		this.emit('manager::session_change');
	}

	public createSession(sourceLayerId?: string): SelectionSession {
		const newSession = new SelectionSession({
			layersManager: this.layersManager,
			sourceLayerId,
			smartObjectsManager: this.smartObjectsManager
		});
		this.setupEventProxyForSession(newSession);
		this.emit('manager::session_created');
		return newSession;
	}

	public getActiveSession(): SelectionSession | null {
		return this.currentSession;
	}

	private clearCurrentSessionAndNotify(endedSession: SelectionSession): void {
		if (this.currentSession === endedSession) {
			this.clearProxiedSessionListeners();
			this.currentSession = null;
		}
		this.emit('manager::session_change');
	}

	public async executeCommand(command: ISessionManagerCommand): Promise<void> {
		try {
			await command.execute(
				{
					layersManager: this.layersManager,
					fontManager: this.fontManager,
					config: this.config,
					historyManager: this.historyManager
				},
				this
			);
		} catch (e) {
			throw new Error(`Command execution failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	public async executeCommandOnActiveSession(command: ISessionCommand): Promise<void> {
		const sessionForCommand = this.currentSession;
		if (!sessionForCommand) return;

		await command.execute(
			this.currentSession!,
			{
				layersManager: this.layersManager,
				fontManager: this.fontManager,
				config: this.config,
				historyManager: this.historyManager
			},
			this
		);
	}

	public commitSession(session: SelectionSession) {
		session.commit();
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public cancelSession(session: SelectionSession) {
		session.cancel();
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public deleteSession(session: SelectionSession) {
		session.remove();
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public commitActiveSession() {
		const session = this.currentSession;
		if (!session) return null;

		this.commitSession(session);
		this.currentSession = null;
	}

	public cancelActiveSession() {
		const session = this.currentSession;
		if (!session) return null;
		// Forward to commit behavior
		this.cancelSession(session);
	}

	public deleteActiveSession() {
		const session = this.currentSession;
		if (!session) return null;
		this.deleteSession(session);
	}

	public serializeSession(session: SelectionSession): SessionSnapshot {
		return session.serialize();
	}

	public deserializeSession(sessionData: SessionSnapshot): SelectionSession {
		const newSession = SelectionSession.fromSnapshot(sessionData, {
			layersManager: this.layersManager,
			smartObjectsManager: this.smartObjectsManager
		});
		this.setupEventProxyForSession(newSession);

		return newSession;
	}

	public serializeActiveSession(): SessionSnapshot | null {
		return this.currentSession ? this.currentSession.serialize() : null;
	}

	public restoreSession(sessionData: SessionSnapshot | null): SelectionSession | null {
		const oldSessionInstance = this.currentSession;
		if (oldSessionInstance) {
			oldSessionInstance.cancel();
			this.emit('manager::session_destroyed');
		}

		if (!sessionData) {
			if (oldSessionInstance) {
				this.clearCurrentSessionAndNotify(oldSessionInstance);
			}
			return null;
		}

		if (!sessionData) return null;

		const newSession = SelectionSession.fromSnapshot(sessionData, {
			layersManager: this.layersManager,
			smartObjectsManager: this.smartObjectsManager
		});
		this.setupEventProxyForSession(newSession);
		this.currentSession = newSession;
		this.currentSession.recalculateBoundingBox();

		this.emit('manager::session_created');
		this.emit('manager::session_change');

		return newSession;
	}

	public getLayersManager() {
		return this.layersManager;
	}

	public getSmartObjectsManager() {
		return this.smartObjectsManager;
	}
}
