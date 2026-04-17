import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/serializer/layer.serializer.schema';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { Layer } from '../layer';

export const removeAndActivateLayer = createActionDefinition<
	'layers::remove_and_activate',
	{ id: string },
	{ id: string; layer: Layer }
>('layers::remove_and_activate');

export interface LayerRemoveAndActivateAction extends BaseAction {
	type: typeof removeAndActivateLayer.type;
	before: { layer: LayerSerializableSchemaType; activeKey: string | null };
	after: { layer: null; activeKey: string | null };
}

export class LayerRemoveAndActivate
	implements
		ActionHandler<
			LayerRemoveAndActivateAction,
			typeof removeAndActivateLayer._result,
			typeof removeAndActivateLayer._payload
		>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { id: string }
	): [LayerRemoveAndActivateAction, { id: string; layer: Layer }] {
		const { layerSerializer, layersListManager } = context;
		const { id: layerToRemoveId } = payload;

		const layer = layersListManager.getLayerById(layerToRemoveId);

		if (!layer)
			throw new Error(`Cannot remove layer: Layer with ID "${layerToRemoveId}" not found.`);

		const beforeActiveKey = layersListManager.getActiveLayerKey();
		const { newActive } = layersListManager.removeLayerWithNewActive(layerToRemoveId);

		return [
			{
				type: removeAndActivateLayer.type,
				targetId: `layers`,
				before: { layer: layerSerializer.serialize(layer), activeKey: beforeActiveKey },
				after: { layer: null, activeKey: newActive || null }
			},
			{ id: layerToRemoveId, layer: layer! }
		];
	}

	apply(action: LayerRemoveAndActivateAction, target: LayersManager): void {
		const { layer: layerToRemove } = action.before;
		const layer = target['layers'].getLayerById(layerToRemove.id);
		target['unproxyLayerEvents'](layer);
		target['layers'].removeLayer(layerToRemove.id);
		target['layers'].setActiveLayer(action.after.activeKey);
	}

	revert(
		action: LayerRemoveAndActivateAction,
		target: LayersManager,
		context: LayersExecutionContext
	): void {
		const { layerSerializer } = context;
		const { layer: layerToRestoreData } = action.before;
		const reinsertedLayer = layerSerializer.deserialize(layerToRestoreData);

		target['layers'].insertLayerAtIndex(reinsertedLayer, layerToRestoreData.index);
		target['layers'].setActiveLayer(action.before.activeKey);

		target['proxyLayerEvents'](reinsertedLayer);
	}
}
