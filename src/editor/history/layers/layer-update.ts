import type { ActionHandler, BaseAction } from "@editor/history-manager";
import type { ILayersManager, LayerSerializableSchemaType } from "@editor/types";

export interface LayerUpdateAction extends BaseAction {
  type: 'layer::update';
  before: LayerSerializableSchemaType;
  after: LayerSerializableSchemaType;
}

export class LayerUpdate implements ActionHandler<LayerUpdateAction> {
  apply(action: LayerUpdateAction, target: ILayersManager): void {
    const deserializedLayer = target.deserializeLayer(action.after);

    target.updateLayerSilent(action.after.id, {
      index: deserializedLayer.index,
      name: deserializedLayer.name,
      opts: deserializedLayer.opts
    })

  }

  revert(action: LayerUpdateAction, target: ILayersManager): void {
    const deserializedLayer = target.deserializeLayer(action.before);

    target.updateLayerSilent(action.before.id, {
      index: deserializedLayer.index,
      name: deserializedLayer.name,
      opts: deserializedLayer.opts
    })

  }
}

