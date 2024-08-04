import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ISelectionSessionSnapshot, SelectionSessionManager } from "../select-session-manager";

export interface SelectSessionCancelAction extends BaseAction {
  type: 'select::session_cancel';
  before: {
    session: ISelectionSessionSnapshot | null
    data: string
  };
  after: {
    session: null
    data: string
  };
}

export class SelectSessionCancel implements ActionHandler<SelectSessionCancelAction> {
  apply(action: SelectSessionCancelAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    target.cancel()

    const layerID = action.before.session!.sourceLayerId!
    const activeLayer = coreApi.getLayersManager().getLayer(layerID)
    const selected = action.before.session?.selectedContent[0]

    if (selected) {
      const { worldRegion } = selected
      activeLayer?.clearRegion(worldRegion.startX, worldRegion.startY, worldRegion.width, worldRegion.height)
    }
  }

  revert(action: SelectSessionCancelAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    const layerID = action.before.session?.sourceLayerId
    const activeLayer = coreApi.getLayersManager().getLayer(String(layerID))
    const selected = action.before.session?.selectedContent[0]

    if (selected) {
      const { worldRegion } = selected
      activeLayer?.clearRegion(worldRegion.startX, worldRegion.startY, worldRegion.width, worldRegion.height)
      activeLayer?.setToRegion(worldRegion.startX, worldRegion.startY, action.before.data)
    }
    target.restoreSession(action.before.session);
  }
}

