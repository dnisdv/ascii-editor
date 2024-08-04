import type { CoreApi } from "@editor/core.type";
import type { ActionHandler, BaseAction } from "@editor/history-manager";
import { LayerSerializer, type ILayersManager, type LayerSerializableSchemaType } from "@editor/types";

export interface LayerUpdateAction extends BaseAction {
  type: 'layer::update';
  before: LayerSerializableSchemaType;
  after: LayerSerializableSchemaType;
}

export class LayerUpdate implements ActionHandler<LayerUpdateAction> {
  apply(action: LayerUpdateAction, target: ILayersManager, coreApi: CoreApi): void {
    const deserializedLayer = new LayerSerializer(coreApi).deserialize(action.after);

    target.updateLayerSilent(action.after.id, {
      index: deserializedLayer.index,
      name: deserializedLayer.name,
      opts: deserializedLayer.opts
    })

  }

  revert(action: LayerUpdateAction, target: ILayersManager, coreApi: CoreApi): void {
    const deserializedLayer = new LayerSerializer(coreApi).deserialize(action.before);

    target.updateLayerSilent(action.before.id, {
      index: deserializedLayer.index,
      name: deserializedLayer.name,
      opts: deserializedLayer.opts
    })

  }
}

