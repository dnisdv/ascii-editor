import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { DeepPartial, PrefixedEvents } from '../internal';
import type { ILayerModel } from './layer-model';
import type { ObjectOperation } from './object-operation';
import type { Layer } from '@editor/layers/layer';
import type { ILayerGroup } from './layer-group';

export type LayerEventMap = {
	updated: DeepPartial<Exclude<ILayerModel, 'id'>>;
	'object::added': { object: ISmartObject; toIndex: number; orderKey?: string };
	'object::removed': { id: string };
	'object::moved': { id: string; toIndex: number; orderKey?: string };
	'object::op': { objectId: string; objectType: string; operation: ObjectOperation };
	'object::update': undefined;
};

export type LayersListManagerEvents = {
	'layer::added': { layer: Layer };
	'layer::removed': { id: string };
	'layer::active::changed': { oldId: string | null; newId: string | null };
};

export type ProxiedLayerEvents = PrefixedEvents<LayerEventMap, 'layer::', { layerId: string }>;
export type ProxiedTempLayerEvents = PrefixedEvents<
	LayerEventMap,
	'temp_layer::',
	{ layerId: string }
>;
export type ProxiedLayersListEvents = PrefixedEvents<LayersListManagerEvents>;

export type TempLayerLifecycleEvents = {
	'temp_layer::added': { layer: Layer };
	'temp_layer::removed': { id: string };
};

export type LayerGroupManagerEvents = {
	'group::added': { group: ILayerGroup };
	'group::removed': { id: string };
	'group::updated': { id: string } & DeepPartial<ILayerGroup>;
};

export type LayerSelectionEvents = {
	'layer::selection::changed': { selectedIds: string[] };
};

export type LayersManagerEvents = ProxiedLayerEvents &
	ProxiedLayersListEvents &
	ProxiedTempLayerEvents &
	TempLayerLifecycleEvents &
	LayerGroupManagerEvents &
	LayerSelectionEvents;
