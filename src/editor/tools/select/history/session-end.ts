import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ISelectionSessionSnapshot, SelectionSessionManager } from "../select-session-manager";

export interface SelectSessionEndAction extends BaseAction {
  type: 'select::session_end';
  before: {
    session: ISelectionSessionSnapshot | null
    data: string
  };
  after: {
    session: null
    data: string
  };
}

export class SelectSessionEnd implements ActionHandler<SelectSessionEndAction> {
  apply(action: SelectSessionEndAction, target: SelectionSessionManager, coreApi: CoreApi): void {
    target.cancel()

    const layerID = action.before.session!.sourceLayerId!
    const activeLayer = coreApi.getLayersManager().getLayer(layerID)
    const selected = action.before.session?.selectedContent[0]

    if (selected) {
      const { worldRegion, data } = selected
      activeLayer?.setToRegion(worldRegion.startX, worldRegion.startY, data)
    }
  }

  revert(action: SelectSessionEndAction, target: SelectionSessionManager, coreApi: CoreApi): void {
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

