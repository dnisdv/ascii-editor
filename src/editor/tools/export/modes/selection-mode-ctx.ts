import {
	SelectionModeName,
	type AnyConcreteSelectionMode,
	type ConcreteModeTypeMap,
	type ISelectionMode,
	type ModePayloads
} from './modes.type';
import { IdleMode } from './idle-mode';
import { EventEmitter } from '@editor/event-emitter';

type SelectionModeContextEventType = {
	'ctx::transitioned': undefined;
};

export class SelectionModeContext extends EventEmitter<SelectionModeContextEventType> {
	private currentState: AnyConcreteSelectionMode;
	private modes: Map<SelectionModeName, AnyConcreteSelectionMode>;

	constructor() {
		super();
		this.modes = new Map();
		this.currentState = new IdleMode();
		this.selectAppropiateState();
	}

	private selectAppropiateState() {
		this.currentState = new IdleMode();
		this.currentState.onEnter(this, undefined);
	}

	public registerMode(name: SelectionModeName, mode: AnyConcreteSelectionMode): void {
		this.modes.set(name, mode);
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
		for (const [name] of this.modes.entries()) {
			if (name === this.currentState.name) {
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

	public onMouseLeave(event: MouseEvent): void {
		this.currentState.handleMouseLeave?.(event, this);
	}

	public onKeyPress(event: KeyboardEvent): void {
		this.currentState.handleKeyDown?.(event, this);
	}

	public cleanup(): void {
		this.modes.forEach((mode) => {
			if (mode.cleanup) {
				mode.cleanup();
			}
		});
		this.selectAppropiateState();
	}
}
