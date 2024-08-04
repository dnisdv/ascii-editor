import type { ILayer } from "@editor/types";
import type { LayerSerializableSchemaType } from "./layer.serializer.schema";
import { Layer } from "@editor/layers/layer";
import { TileMap } from "@editor/tileMap";
import type { CoreApi } from "@editor/core.type";

export class LayerSerializer {
  constructor(private coreApi: CoreApi) { }

  serialize(layer: ILayer): LayerSerializableSchemaType {
    return {
      id: layer.id,
      name: layer.name,
      tileMap: layer.tileMap.serialize(),
      index: layer.index,
      opts: layer.opts,
    };
  }

  deserialize(layerData: LayerSerializableSchemaType): ILayer {
    if (!layerData.tileMap) {
      throw new Error('TileMap is required for layer deserialization');
    }
    const tileMap = TileMap.deserialize(layerData.tileMap);
    const newLayer = new Layer({
      id: layerData.id,
      name: layerData.name,
      index: layerData.index,
      opts: layerData.opts,
      tileMap,
      coreApi: this.coreApi,
    });

    return newLayer;
  }
}

