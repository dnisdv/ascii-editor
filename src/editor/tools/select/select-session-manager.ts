import type { CoreApi } from "@editor/core.type";
import { SingleSelectionSession, type ISelectionSession, type SelectionEventMap } from "./select-session";
import { EventEmitter } from "@editor/event-emitter";
import { SelectionSessionBuilder } from "./select-session-builder";
import type { Tile } from "./selection-model";

type EventType = {
  'session::start': { session: ISelectionSession };
  'session::end': { session: ISelectionSession };
  'session::commit': { session: ISelectionSession };
  'session::cancel': { session: ISelectionSession };
  'session::destroy': { session: ISelectionSession };
  'session::content-selected': ISelectionSession;
  'session::rotated': SelectionEventMap['session::rotated'];
};

export interface ISelectionSessionSnapshot {
  id: string;
  boundingBox: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  selectedContent: Tile[];
  tempLayerId: string;
  sourceLayerId: string;
}

export class SelectionSessionManager extends EventEmitter<EventType> {
  private currentSession: ISelectionSession | null = null;

  constructor(private coreApi: CoreApi) {
    super();
    this.on('session::start', ({ session }) => {
      this.currentSession = session;
      this.subscribeToSession(session);
    });
  }

  private subscribeToSession(session: ISelectionSession): void {
    session.on('session::content-selected', () => {
      this.emit('session::content-selected', session);
    });
    session.on('session::rotated', (event) => {
      this.emit('session::rotated', event);
    });
  }

  private clearExistingSession(): void {
    if (this.currentSession) {
      if (this.currentSession.getSelectedContent().length > 0) {
        this.commit();
      } else {
        this.cancel();
      }
    }
  }

  private finalizeSession(action: 'commit' | 'cancel'): void {
    if (!this.currentSession) return;
    const session = this.currentSession;
    this.emit('session::end', { session });
    if (action === 'commit') {
      this.emit('session::commit', { session });
      session.commit();
    } else {
      this.emit('session::cancel', { session });
      session.cancel();
    }
    this.currentSession = null;
  }

  createSessionBuilder(): SelectionSessionBuilder {
    this.clearExistingSession();
    return new SelectionSessionBuilder(this.coreApi, this);
  }

  isValidSession(session: ISelectionSession): boolean {
    return session.getSelectedContent().length > 0;
  }

  getActiveSession(): ISelectionSession | null {
    return this.currentSession;
  }

  commit(): void {
    this.finalizeSession('commit');
  }

  cancel(): void {
    this.finalizeSession('cancel');
  }

  destroy(): void {
    if (this.currentSession) {
      const currentSession = this.currentSession;
      this.currentSession.cancel();
      this.currentSession = null;
      this.emit('session::destroy', { session: currentSession });
    }
  }

  serializeSession(session: ISelectionSession): ISelectionSessionSnapshot | null {
    return session ? session.serialize() : null;
  }

  serializeActiveSession(): ISelectionSessionSnapshot | null {
    return this.currentSession ? this.currentSession.serialize() : null;
  }

  restoreSession(sessionData: ISelectionSessionSnapshot | null): void {
    if (this.currentSession) {
      this.cancel();
    }
    if (!sessionData) return;
    this.currentSession = SingleSelectionSession.fromSnapshot(this.coreApi, sessionData);
    this.subscribeToSession(this.currentSession);
    this.emit('session::start', { session: this.currentSession });
  }
}

