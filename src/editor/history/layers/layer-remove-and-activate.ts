import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { LayerSerializableSchemaType } from "@editor/serializer/layer.serializer.schema";
import { LayerSerializer, type ILayersManager } from "@editor/types";

export interface LayerRemoveAndActivateAction extends BaseAction {
  type: 'layers::remove_and_activate';
  before: { layer: LayerSerializableSchemaType, activeKey: string };
  after: { layer: null, activeKey: string };
}

export class LayerRemoveAndActivate implements ActionHandler<LayerRemoveAndActivateAction> {
  apply(action: LayerRemoveAndActivateAction, target: ILayersManager): void {
    const { layer } = action.before
    target.removeLayerSilent(layer.id)
  }

  revert(action: LayerRemoveAndActivateAction, target: ILayersManager, coreApi: CoreApi): void {
    const { layer } = action.before
    const newLayer = new LayerSerializer(coreApi).deserialize(layer)
    target.insertLayerAtIndex(layer.index, newLayer)
    target.silentActivateLayer(layer.id)
  }
}


