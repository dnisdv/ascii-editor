import type { LayerConfig } from "@editor/types"

export interface ILayerModel {
  id: string,
  opts: Partial<LayerConfig>
  name: string,
  index: number
}


