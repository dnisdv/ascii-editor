import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { LayerSerializableSchemaType } from "@editor/serializer/layer.serializer.schema";
import type { ILayersManager } from "@editor/types";

export interface LayerCreateAndActivateAction extends BaseAction {
  type: 'layers::create_and_activate';
  before: { layer: null, activeKey: string };
  after: { layer: LayerSerializableSchemaType, activeKey: string };
}

export class LayerCreateAndActivate implements ActionHandler<LayerCreateAndActivateAction> {
  apply(action: LayerCreateAndActivateAction, target: ILayersManager): void {
    const { layer } = action.after
    const newLayer = target.deserializeLayer(layer)
    target.insertLayer(layer.id, newLayer)
    target.silentActivateLayer(layer.id)
  }

  revert(action: LayerCreateAndActivateAction, target: ILayersManager): void {
    target.removeLayer(action.after.layer.id)
  }
}


