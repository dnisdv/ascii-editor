import type { CoreApi } from "@editor/core.type";
import { defaultLayerConfig, Layer } from "./layer";
import { nanoid } from "@reduxjs/toolkit";
import { TileMap } from "@editor/tileMap";
import type { ILayer, ILayerModel, ITileMap } from "@editor/types";

export class LayerFactory {
  constructor(private coreApi: CoreApi) { }

  createLayerWithDefaultConfig(): [string, ILayer] {
    const id = nanoid()
    const tileSize = this.coreApi.getConfig().tileSize;
    const tileMap = new TileMap({ tileSize })

    const layer = new Layer({
      id,
      // TODO USO LAYER_NAME_KEY, let the ui to choose the name
      name: 'Untitled layer',
      index: 0,
      opts: defaultLayerConfig,
      coreApi: this.coreApi,
      tileMap
    });

    return [id, layer];
  }

  createTempLayer(): [string, ILayer] {
    return this.createLayerWithDefaultConfig()
  }

  newLayer({ id, name, opts, tileMap, index }: ILayerModel & { tileMap: ITileMap }) {
    return new Layer({
      id, name, opts, index, tileMap, coreApi: this.coreApi
    })
  }
}

