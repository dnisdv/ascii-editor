import type { CoreApi } from "@editor/core.type";
import type { ISessionManagerCommand } from "./type";
import type { SelectionSessionManager } from "../selection-session-manager";

export class CreateAndReplaceSessionCommand implements ISessionManagerCommand {
  public execute(_: CoreApi, manager: SelectionSessionManager): void {
    const oldSession = manager.getActiveSession();
    oldSession?.commit();

    const newSession = manager.createSession()
    manager.setActiveSession(newSession);
  }
}
