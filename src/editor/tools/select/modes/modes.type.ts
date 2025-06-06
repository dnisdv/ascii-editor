import type { IdleMode } from './idle-mode';
import type { MovingMode } from './moving-mode';
import type { RotatingMode } from './rotating.mode';
import type { SelectedMode } from './selected-mode';
import type { SelectingMode } from './selecting-mode';
import type { SelectionModeContext } from './selection-mode-ctx';

export type IdleModePayload = undefined;
export type SelectedModePayload = undefined;

export type SelectingModePayload = {
	mouseDownEvent: MouseEvent;
};

export interface MovingModePayload {
	mouseDownEvent: MouseEvent;
}
export interface RotatingModePayload {
	mouseDownEvent: MouseEvent;
}

export type ModePayloads = {
	[SelectionModeName.IDLE]: IdleModePayload;
	[SelectionModeName.SELECTING]: SelectingModePayload;
	[SelectionModeName.SELECTED]: SelectedModePayload;
	[SelectionModeName.MOVING]: MovingModePayload;
	[SelectionModeName.ROTATING]: RotatingModePayload;
};

export interface ISelectionModeBase {
	readonly name: string;
	onExit(ctx: SelectionModeContext): void;
	handleMouseDown(event: MouseEvent, ctx: SelectionModeContext): void;
	handleMouseMove(event: MouseEvent, ctx: SelectionModeContext): void;
	handleMouseUp(event: MouseEvent, ctx: SelectionModeContext): void;
	handleMouseLeave?(event: MouseEvent, ctx: SelectionModeContext): void;
	handleKeyDown?(event: KeyboardEvent, ctx: SelectionModeContext): void;

	getName(): string;
}

export interface ISelectionMode<MName extends SelectionModeName> extends ISelectionModeBase {
	readonly name: MName;
	onEnter(ctx: SelectionModeContext, payload: ModePayloads[MName] | undefined): void;
	cleanup?(): void;
}

export enum SelectionModeName {
	IDLE = 'IDLE_MODE',
	SELECTING = 'SELECTING_MODE',
	SELECTED = 'SELECTED_MODE',
	ROTATING = 'ROTATING_MODE',
	MOVING = 'MOVING_MODE'
}

export type AnyConcreteSelectionMode =
	| ISelectionMode<SelectionModeName.IDLE>
	| ISelectionMode<SelectionModeName.SELECTING>
	| ISelectionMode<SelectionModeName.SELECTED>
	| ISelectionMode<SelectionModeName.ROTATING>
	| ISelectionMode<SelectionModeName.MOVING>;

export interface ConcreteModeTypeMap {
	[SelectionModeName.IDLE]: IdleMode;
	[SelectionModeName.SELECTING]: SelectingMode;
	[SelectionModeName.SELECTED]: SelectedMode;
	[SelectionModeName.ROTATING]: RotatingMode;
	[SelectionModeName.MOVING]: MovingMode;
}
