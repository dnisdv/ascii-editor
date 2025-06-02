import {
	SelectionModeName,
	type AnyConcreteSelectionMode,
	type ConcreteModeTypeMap,
	type ISelectionMode,
	type ModePayloads
} from './modes.type';
import { IdleMode } from './idle-mode';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import { SelectedMode } from './selected-mode';
import { EventEmitter } from '@editor/event-emitter';
import type { CoreApi } from '@editor/core';

type SelectionModeContextEventType = {
	'ctx::transitioned': undefined;
};

export class SelectionModeContext extends EventEmitter<SelectionModeContextEventType> {
	private currentState: AnyConcreteSelectionMode;
	private modes: Map<SelectionModeName, AnyConcreteSelectionMode>;
	public coreApi: CoreApi;
	public isRestricted: boolean = false;

	constructor(coreApi: CoreApi, sessionManager: SelectionSessionManager) {
		super();
		this.coreApi = coreApi;
		this.modes = new Map();

		const activeSession = sessionManager.getActiveSession();
		if (!activeSession || !activeSession?.isEmpty()) {
			this.currentState = new SelectedMode(coreApi, sessionManager);
			this.currentState.onEnter(this, undefined);
			return;
		}

		this.currentState = new IdleMode();
		this.currentState.onEnter(this, undefined);
	}

	public registerMode(name: SelectionModeName, mode: AnyConcreteSelectionMode): void {
		this.modes.set(name, mode);
	}

	public setRestricted(restricted: boolean): void {
		this.isRestricted = restricted;
	}

	public isRestrictedMode(): boolean {
		return this.isRestricted;
	}

	public transitionTo<MName extends SelectionModeName>(
		modeName: MName,
		payload?: ModePayloads[MName]
	): void {
		const newMode = this.modes.get(modeName);
		if (!newMode) {
			console.error(`Mode ${modeName} not registered.`);
			return;
		}

		this.currentState.onExit(this);
		this.currentState = newMode;

		(this.currentState as ISelectionMode<MName>).onEnter(this, payload);
		this.emit('ctx::transitioned');
	}

	public getMode<MName extends SelectionModeName>(
		modeName: MName
	): ConcreteModeTypeMap[MName] | undefined {
		const mode = this.modes.get(modeName);
		return mode as ConcreteModeTypeMap[MName] | undefined;
	}

	public getCurrentMode(): AnyConcreteSelectionMode {
		return this.currentState;
	}

	public getCurrentModeName(): SelectionModeName {
		for (const [name, mode] of this.modes.entries()) {
			if (mode === this.currentState) {
				return name;
			}
		}
		return SelectionModeName.IDLE;
	}

	public onMouseDown(event: MouseEvent): void {
		this.currentState.handleMouseDown(event, this);
	}

	public onMouseMove(event: MouseEvent): void {
		this.currentState.handleMouseMove(event, this);
	}

	public onMouseUp(event: MouseEvent): void {
		this.currentState.handleMouseUp(event, this);
	}

	public onKeyPress(event: KeyboardEvent): void {
		this.currentState.handleKeyDown?.(event, this);
	}
}
