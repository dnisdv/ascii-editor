import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ISelectionSessionSnapshot, SelectionSessionManager } from "../select-session-manager";

export interface SelectSessionChangeAction extends BaseAction {
  type: 'select::session_change';
  before: ISelectionSessionSnapshot | null;
  after: ISelectionSessionSnapshot | null;
}

export class SelectSessionChange implements ActionHandler<SelectSessionChangeAction> {
  apply(action: SelectSessionChangeAction, target: SelectionSessionManager): void {
    target.restoreSession(action.after);
  }

  revert(action: SelectSessionChangeAction, target: SelectionSessionManager): void {
    target.restoreSession(action.before);
  }
}

