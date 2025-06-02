import type { LayerConfig } from '@editor/types';

export interface ILayerModel {
	id: string;
	opts: LayerConfig;
	name: string;
	index: number;
}
