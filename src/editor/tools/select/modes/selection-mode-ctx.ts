import {
	SelectionModeName,
	type AnyConcreteSelectionMode,
	type ConcreteModeTypeMap,
	type ISelectionMode,
	type ModePayloads
} from './modes.type';
import { EventEmitter } from '@editor/event-emitter';
import type { CoreApi } from '@editor/core';
import type { SelectionManager } from '@editor/select/selection-manager';
import { IdleMode } from './idle-mode';

type SelectionModeContextEventType = {
	'ctx::transitioned': undefined;
};

export class SelectionModeContext extends EventEmitter<SelectionModeContextEventType> {
	private currentState: AnyConcreteSelectionMode | null = null;
	private modes: Map<SelectionModeName, AnyConcreteSelectionMode> = new Map();
	public isRestricted: boolean = false;

	constructor(
		private coreApi: CoreApi,
		private selectionManager: SelectionManager
	) {
		super();
		this.currentState = new IdleMode();
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

		if (this.currentState) {
			this.currentState.onExit(this);
		}
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

	public getCurrentMode(): AnyConcreteSelectionMode | null {
		return this.currentState;
	}

	public getCurrentModeName(): SelectionModeName | null {
		return this.currentState?.name || null;
	}

	public onMouseDown(event: MouseEvent): void {
		this.currentState?.handleMouseDown(event, this);
	}

	public onMouseMove(event: MouseEvent): void {
		this.currentState?.handleMouseMove(event, this);
	}

	public onMouseUp(event: MouseEvent): void {
		this.currentState?.handleMouseUp(event, this);
	}

	public onMouseLeave(event: MouseEvent): void {
		this.currentState?.handleMouseLeave?.(event, this);
	}

	public onKeyPress(event: KeyboardEvent): void {
		this.currentState?.handleKeyDown?.(event, this);
	}

	public cleanup(): void {
		this.modes.forEach((mode) => {
			if (mode.cleanup) {
				mode.cleanup();
			}
		});
		if (this.currentState?.name !== SelectionModeName.IDLE) {
			this.transitionTo(SelectionModeName.IDLE);
		}
	}
}
