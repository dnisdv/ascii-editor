import { EventEmitter } from '@editor/event-emitter';
import { SingleSelectSession, type Rectangle, type SessionEventType } from './selection-session';
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
			'session::region_updated'
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

	public createAndReplaceActiveSession() {
		this.cancelActiveSession();

		const newSession = new SingleSelectSession(this.coreApi);
		this.setupEventProxyForSession(newSession);
		this.emit('manager::session_created');
		this.currentSession = newSession;
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

	public cancelSession(session: SingleSelectSession) {
		this.clearCurrentSessionAndNotify(session);
		this.emit('manager::session_destroyed');
	}

	public cancelActiveSession() {
		const session = this.currentSession;
		if (!session) return null;
		this.cancelSession(session);
	}

	public serializeActiveSession(): { selectedRegion: Rectangle | null } | null {
		if (!this.currentSession) {
			return null;
		}
		return {
			selectedRegion: this.currentSession.getSelectedRegion()
		};
	}

	public restoreSession(sessionData: { selectedRegion: Rectangle | null } | null): void {
		if (sessionData && sessionData.selectedRegion) {
			const newSession = this.createAndReplaceActiveSession();
			newSession.updateSelectedRegion(sessionData.selectedRegion);
		} else {
			this.cancelActiveSession();
		}
	}
}
