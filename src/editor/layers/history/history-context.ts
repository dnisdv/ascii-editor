import type { LayerSerializer } from '@editor/serializer';
import type { LayerFactory } from '../layer-factory';
import type { LayersListManager } from '../layer-list-manager';
import type { LayersManager } from '../layers-manager';

export interface LayersExecutionContext {
	layerSerializer: LayerSerializer;
	layerFactory: LayerFactory;
	layersListManager: LayersListManager;
	layersManager: LayersManager;
}
