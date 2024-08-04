import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ISelectionSessionSnapshot, SelectionSessionManager } from "../select-session-manager";

export interface SelectSessionAction extends BaseAction {
  type: 'select::session_select';
  before: {
    session: null
    data: string
  };
  after: {
    session: ISelectionSessionSnapshot
    data: string
  };
}

export class SelectSession implements ActionHandler<SelectSessionAction> {
  apply(action: SelectSessionAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    const layerID = action.after.session.sourceLayerId
    const activeLayer = coreApi.getLayersManager().getLayer(String(layerID))
    const selected = action.after.session.selectedContent[0]

    if (selected) {
      const { worldRegion } = selected
      activeLayer?.clearRegion(worldRegion.startX, worldRegion.startY, worldRegion.width, worldRegion.height)
    }

    target.restoreSession(action.after.session);
  }

  revert(action: SelectSessionAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    target.cancel()
    const layerID = action.after.session.sourceLayerId
    const activeLayer = coreApi.getLayersManager().getLayer(String(layerID))
    const selected = action.after.session.selectedContent[0]

    if (selected) {
      const { worldRegion } = selected
      activeLayer?.setToRegion(worldRegion.startX, worldRegion.startY, action.before.data)

    }
  }
}

