import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/serializer/layer.serializer.schema';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { Layer } from '../layer';

export const createAndActivateLayer = createActionDefinition<
	'layers::create_and_activate',
	void,
	{ id: string; layer: Layer }
>('layers::create_and_activate');

export interface LayerCreateAndActivateAction extends BaseAction {
	type: typeof createAndActivateLayer.type;
	before: { layer: null; activeKey: string | null };
	after: { layer: LayerSerializableSchemaType; activeKey: string };
}

export class LayerCreateAndActivate
	implements
		ActionHandler<
			LayerCreateAndActivateAction,
			typeof createAndActivateLayer._result,
			typeof createAndActivateLayer._payload
		>
{
	public execute(
		target: LayersManager,
		context: LayersExecutionContext
	): [LayerCreateAndActivateAction, { id: string; layer: Layer }] {
		const { layerFactory, layerSerializer, layersListManager } = context;

		const beforeActiveKey = layersListManager.getActiveLayerKey();
		const beforeState = {
			layer: null,
			activeKey: beforeActiveKey
		};

		const [id, layer] = layerFactory.createLayerWithDefaultConfig();
		layersListManager.addLayer(layer);
		layersListManager.setActiveLayer(id);

		target['proxyLayerEvents'](layer);

		const afterState = {
			layer: layerSerializer.serialize(layer),
			activeKey: id
		};

		return [
			{
				type: createAndActivateLayer.type,
				targetId: 'layers',
				before: beforeState,
				after: afterState
			},
			{ id, layer }
		];
	}

	apply(
		action: LayerCreateAndActivateAction,
		target: LayersManager,
		context: LayersExecutionContext
	): void {
		const { layer: layerData } = action.after;
		const newLayer = context.layerSerializer.deserialize(layerData);

		target['layers'].addLayer(newLayer);
		target['layers'].setActiveLayer(layerData.id);
		target['proxyLayerEvents'](newLayer);
	}

	revert(action: LayerCreateAndActivateAction, target: LayersManager): void {
		const layer = target['layers'].getLayerById(action.after.activeKey);
		target['unproxyLayerEvents'](layer);
		target['layers'].removeLayer(action.after.activeKey);
		target['layers'].setActiveLayer(action.before.activeKey);
	}
}
