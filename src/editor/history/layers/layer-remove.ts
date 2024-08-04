import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import { LayerSerializer, type ILayersManager, type LayerSerializableSchemaType } from "@editor/types";

export interface LayerRemoveAction extends BaseAction {
  type: 'layers::remove';
  before: { layer: LayerSerializableSchemaType, };
  after: { layer: null };
}

export class LayerRemove implements ActionHandler<LayerRemoveAction> {
  apply(action: LayerRemoveAction, target: ILayersManager): void {
    const { layer } = action.before
    target.removeLayerSilent(layer.id)
  }

  revert(action: LayerRemoveAction, target: ILayersManager, coreApi: CoreApi): void {
    const { layer } = action.before
    const newLayer = new LayerSerializer(coreApi).deserialize(layer)
    target.insertLayerAtIndex(layer.index, newLayer)
    target.silentActivateLayer(layer.id)
  }
}


