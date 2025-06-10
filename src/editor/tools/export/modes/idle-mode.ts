import { SelectionModeName, type ISelectionMode } from './modes.type';
import type { SelectionModeContext } from './selection-mode-ctx';

export class IdleMode implements ISelectionMode<SelectionModeName.IDLE> {
	readonly name = SelectionModeName.IDLE;

	getName(): string {
		return this.name;
	}
	onEnter(): void {}
	onExit(): void {}

	handleMouseDown(event: MouseEvent, context: SelectionModeContext): void {
		context.transitionTo(SelectionModeName.SELECTING, { mouseDownEvent: event });
	}

	handleMouseMove() {}
	handleMouseUp(): void {}
}
