import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { SingleSessionSnapshot } from "../session/selection-session";
import type { SelectionSessionManager } from "../session/selection-session-manager";
import type { CoreApi } from "@editor/core.type";

export interface SelectSessionCommitAction extends BaseAction {
  type: 'select::session_commit';
  before: {
    session: SingleSessionSnapshot;
    data: string
  };
  after: {
    session: null;
    data: string
  };
}

export class SelectSessionCommit implements ActionHandler<SelectSessionCommitAction> {
  apply(action: SelectSessionCommitAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    const sessionToCommitSnapshot = action.before.session;
    const contentToCommit = sessionToCommitSnapshot.selectedContent;
    const targetLayerId = sessionToCommitSnapshot.sourceLayerId;

    if (contentToCommit && targetLayerId) {
      const activeLayer = coreApi.getLayersManager().getLayer(targetLayerId);
      if (activeLayer) {
        activeLayer.setToRegion(
          contentToCommit.region.startX,
          contentToCommit.region.startY,
          contentToCommit.data
        );
      }
    }
    if (target.getActiveSession()?.id === sessionToCommitSnapshot.id) {
      target.commitActiveSession();
    } else {
      target.restoreSession(null);
    }
  }

  revert(action: SelectSessionCommitAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    target.restoreSession(action.before.session);

    const sessionBeforeCommit = action.before.session;
    const contentThatWasCommitted = sessionBeforeCommit.selectedContent;
    const targetLayerId = sessionBeforeCommit.sourceLayerId;

    if (targetLayerId && contentThatWasCommitted) {
      const activeLayer = coreApi.getLayersManager().getLayer(targetLayerId);
      if (activeLayer) {
        activeLayer.clearRegion(
          contentThatWasCommitted.region.startX,
          contentThatWasCommitted.region.startY,
          contentThatWasCommitted.region.width,
          contentThatWasCommitted.region.height
        );

        activeLayer.setToRegion(
          contentThatWasCommitted.region.startX,
          contentThatWasCommitted.region.startY,
          action.before.data
        );

      }
    }
  }
}


