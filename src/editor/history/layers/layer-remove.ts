import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ILayersManager, LayerSerializableSchemaType } from "@editor/types";

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

  revert(action: LayerRemoveAction, target: ILayersManager): void {
    const { layer } = action.before
    const newLayer = target.deserializeLayer(layer)
    target.insertLayerAtIndex(layer.index, newLayer)
    target.silentActivateLayer(layer.id)
  }
}


