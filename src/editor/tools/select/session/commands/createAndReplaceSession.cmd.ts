import type { CoreApi } from "@editor/core.type";
import type { ISessionManagerCommand } from "./type";
import type { SelectionSessionManager } from "../selection-session-manager";

export class CreateAndReplaceSessionCommand implements ISessionManagerCommand {
  public execute(_: CoreApi, manager: SelectionSessionManager): void {
    manager.commitActiveSession()
    const newSession = manager.createSession()
    manager.setActiveSession(newSession);
  }
}
