import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import { LayerSerializer } from "@editor/serializer/layer.serializer";
import type { LayerSerializableSchemaType } from "@editor/serializer/layer.serializer.schema";
import type { ILayersManager } from "@editor/types";

export interface LayerCreateAndActivateAction extends BaseAction {
  type: 'layers::create_and_activate';
  before: { layer: null, activeKey: string };
  after: { layer: LayerSerializableSchemaType, activeKey: string };
}

export class LayerCreateAndActivate implements ActionHandler<LayerCreateAndActivateAction> {
  apply(action: LayerCreateAndActivateAction, target: ILayersManager, coreApi: CoreApi): void {
    const { layer } = action.after
    const newLayer = new LayerSerializer(coreApi).deserialize(layer)
    target.insertLayer(layer.id, newLayer)
    target.silentActivateLayer(layer.id)
  }

  revert(action: LayerCreateAndActivateAction, target: ILayersManager): void {
    target.removeLayer(action.after.layer.id)
  }
}


