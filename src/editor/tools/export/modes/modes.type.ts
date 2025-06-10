import type { IdleMode } from './idle-mode';
import type { MovingMode } from './moving-mode';
import type { ResizingMode } from './resizing-mode';
import type { SelectedMode } from './selected-mode';
import type { SelectingMode } from './selecting-mode';
import type { SelectionModeContext } from './selection-mode-ctx';

export enum HandlePosition {
	TopLeft,
	Top,
	TopRight,
	Right,
	BottomRight,
	Bottom,
	BottomLeft,
	Left
}

export type SelectedModePayload = {
	mouseEvent?: MouseEvent;
};

export type IdleModePayload = undefined;

export type SelectingModePayload = {
	mouseDownEvent: MouseEvent;
};

export interface MovingModePayload {
	mouseDownEvent: MouseEvent;
}

export interface ResizingModePayload {
	mouseDownEvent: MouseEvent;
	handle: HandlePosition;
}

export type ModePayloads = {
	[SelectionModeName.IDLE]: IdleModePayload;
	[SelectionModeName.SELECTING]: SelectingModePayload;
	[SelectionModeName.SELECTED]: SelectedModePayload;
	[SelectionModeName.MOVING]: MovingModePayload;
	[SelectionModeName.RESIZING]: ResizingModePayload;
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
	MOVING = 'MOVING_MODE',
	RESIZING = 'RESIZING_MODE'
}

export type AnyConcreteSelectionMode =
	| ISelectionMode<SelectionModeName.IDLE>
	| ISelectionMode<SelectionModeName.SELECTING>
	| ISelectionMode<SelectionModeName.SELECTED>
	| ISelectionMode<SelectionModeName.MOVING>
	| ISelectionMode<SelectionModeName.RESIZING>;

export interface ConcreteModeTypeMap {
	[SelectionModeName.IDLE]: IdleMode;
	[SelectionModeName.SELECTING]: SelectingMode;
	[SelectionModeName.SELECTED]: SelectedMode;
	[SelectionModeName.MOVING]: MovingMode;
	[SelectionModeName.RESIZING]: ResizingMode;
}
