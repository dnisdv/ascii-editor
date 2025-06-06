import { EventEmitter } from '@editor/event-emitter';
import {
	SingleSelectSession,
	type SessionEventType,
	type SingleSessionSnapshot
} from './selection-session';
import type { ISessionCommand, ISessionManagerCommand } from './commands/type';
import type { CoreApi } from '@editor/core';

type ManagerEventType = SessionEventType & {
	'manager::session_created': undefined;
	'manager::session_destroyed': undefined;
	'manager::session_change': undefined;
};

export class SelectionSessionManager extends EventEmitter<ManagerEventType> {
	private currentSession: SingleSelectSession | null = null;
	private coreApi: CoreApi;
	private activeSessionUnsubscribeCallbacks: (() => void)[] = [];

	constructor(coreApi: CoreApi) {
		super();
		this.coreApi = coreApi;
	}

	private clearProxiedSessionListeners(): void {
		this.activeSessionUnsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
		this.activeSessionUnsubscribeCallbacks = [];
	}

	private setupEventProxyForSession(session: SingleSelectSession): void {
		this.clearProxiedSessionListeners();

		const eventsToProxy: (keyof SessionEventType)[] = [
			'session::initialized',
			'session::region_updated',
			'session::content_updated',
			'session::committed',
			'session::cancelled'
		];

		eventsToProxy.forEach((eventName) => {
			const handler = (payload: SessionEventType[typeof eventName]) => {
				this.emit(eventName as keyof ManagerEventType, payload);
			};
			session.on(eventName, handler);
			this.activeSessionUnsubscribeCallbacks.push(() => session.off(eventName, handler));
		});
	}

	public setActiveSession(newSession: SingleSelectSession) {
		this.currentSession = newSession;
		this.emit('manager::session_change');
	}

	public createSession(): SingleSelectSession {
		const newSession = new SingleSelectSession(this.coreApi);
		this.setupEventProxyForSession(newSession);
		this.emit('manager::session_created');
		return newSession;
	}

	public getActiveSession(): SingleSelectSession | null {
		return this.currentSession;
	}

	private clearCurrentSessionAndNotify(endedSession: SingleSelectSession): void {
		if (this.currentSession === endedSession) {
			this.clearProxiedSessionListeners();
			this.currentSession = null;
		}
		this.emit('manager::session_change');
	}

	public async executeCommand(command: ISessionManagerCommand): Promise<void> {
		try {
			await command.execute(this.coreApi, this);
		} catch (e) {
			throw new Error(`Command execution failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	public async executeCommandOnActiveSession(command: ISessionCommand): Promise<void> {
		const sessionForCommand = this.currentSession;
		if (!sessionForCommand) return;
		await command.execute(sessionForCommand, this.coreApi, this);
	}

	public commitSession(session: SingleSelectSession) {
		session.commit();
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public cancelSession(session: SingleSelectSession) {
		session.cancel();
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public commitActiveSession() {
		const session = this.currentSession;
		if (!session) return null;
		this.commitSession(session);
	}

	public cancelActiveSession() {
		const session = this.currentSession;
		if (!session) return null;
		this.cancelSession(session);
	}

	public serializeSession(session: SingleSelectSession): SingleSessionSnapshot {
		return session.serialize();
	}

	public serializeActiveSession(): SingleSessionSnapshot | null {
		return this.currentSession ? this.currentSession.serialize() : null;
	}

	public restoreSession(sessionData: SingleSessionSnapshot | null): SingleSelectSession | null {
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

		const newSession = new SingleSelectSession(this.coreApi);
		this.setupEventProxyForSession(newSession);
		this.currentSession = newSession;
		SingleSelectSession.fromSnapshot(newSession, sessionData);

		this.emit('manager::session_created');
		this.emit('manager::session_change');

		return newSession;
	}

	public getLayersManager() {
		return this.coreApi.getLayersManager();
	}
}
