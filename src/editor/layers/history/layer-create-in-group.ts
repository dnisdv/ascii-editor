import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/serializer/layer.serializer.schema';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { Layer } from '../layer';

export interface CreateLayerInGroupPayload {
	groupId: string;
}

export const createLayerInGroup = createActionDefinition<
	'layers::create_in_group',
	CreateLayerInGroupPayload,
	{ id: string; layer: Layer }
>('layers::create_in_group');

export interface CreateLayerInGroupAction extends BaseAction {
	type: typeof createLayerInGroup.type;
	before: { activeKey: string | null };
	after: { layer: LayerSerializableSchemaType; activeKey: string };
}

export class LayerCreateInGroup
	implements
		ActionHandler<
			CreateLayerInGroupAction,
			typeof createLayerInGroup._result,
			typeof createLayerInGroup._payload
		>
{
	execute(
		target: LayersManager,
		context: LayersExecutionContext,
		payload: CreateLayerInGroupPayload
	): [CreateLayerInGroupAction, { id: string; layer: Layer }] {
		const { layerFactory, layerSerializer, layersListManager } = context;

		const beforeActiveKey = layersListManager.getActiveLayerKey();

		const [id, layer] = layerFactory.createLayerWithDefaultConfig();
		layer.update({ groupId: payload.groupId });
		layersListManager.addLayer(layer);
		layersListManager.setActiveLayer(id);
		target['proxyLayerEvents'](layer);

		return [
			{
				type: createLayerInGroup.type,
				targetId: 'layers',
				before: { activeKey: beforeActiveKey },
				after: { layer: layerSerializer.serialize(layer), activeKey: id }
			},
			{ id, layer }
		];
	}

	apply(
		action: CreateLayerInGroupAction,
		target: LayersManager,
		context: LayersExecutionContext
	): void {
		const { layer: layerData } = action.after;
		const newLayer = context.layerSerializer.deserialize(layerData);

		target['layers'].addLayer(newLayer);
		target['layers'].setActiveLayer(layerData.id);
		target['proxyLayerEvents'](newLayer);
	}

	revert(action: CreateLayerInGroupAction, target: LayersManager): void {
		const layer = target['layers'].getLayerById(action.after.activeKey) || null;
		target['unproxyLayerEvents'](layer);
		target['layers'].removeLayer(action.after.activeKey);
		target['layers'].setActiveLayer(action.before.activeKey);
	}
}
