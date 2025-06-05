import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/serializer/layer.serializer.schema';
import type { LayersManager } from '../layers-manager';

export interface LayerRemoveAndActivateAction extends BaseAction {
	type: 'layers::remove_and_activate';
	before: { layer: LayerSerializableSchemaType; activeKey: string };
	after: { layer: null; activeKey: string };
}

export class LayerRemoveAndActivate implements ActionHandler<LayerRemoveAndActivateAction> {
	apply(action: LayerRemoveAndActivateAction, target: LayersManager): void {
		const { layer: layerToRemove } = action.before;
		target['layers'].removeLayer(layerToRemove.id);
		target['layers'].setActiveLayer(action.after.activeKey);

		target.getBus().emit('layer::remove::response', { id: layerToRemove.id });
		target.getBus().emit('layer::change_active::response', { id: action.after.activeKey });
	}

	revert(action: LayerRemoveAndActivateAction, target: LayersManager): void {
		const { layer: layerToRestoreData } = action.before;
		const reinsertedLayer = target.deserializeLayer(layerToRestoreData);

		target['layers'].insertLayerAtIndex(reinsertedLayer, layerToRestoreData.index);
		target['layers'].setActiveLayer(action.before.activeKey);

		target.getBus().emit('layer::create::response', {
			id: reinsertedLayer.id,
			name: reinsertedLayer.name,
			index: reinsertedLayer.index,
			opts: reinsertedLayer.opts
		});
		target.getBus().emit('layer::change_active::response', { id: action.before.activeKey });
		target['proxyLayerEvents'](reinsertedLayer);
	}
}
