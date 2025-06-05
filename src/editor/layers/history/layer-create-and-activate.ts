import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/serializer/layer.serializer.schema';
import type { LayersManager } from '../layers-manager';

export interface LayerCreateAndActivateAction extends BaseAction {
	type: 'layers::create_and_activate';
	before: { layer: null; activeKey: string };
	after: { layer: LayerSerializableSchemaType; activeKey: string };
}

export class LayerCreateAndActivate implements ActionHandler<LayerCreateAndActivateAction> {
	apply(action: LayerCreateAndActivateAction, target: LayersManager): void {
		const { layer } = action.after;
		const newLayer = target.deserializeLayer(layer);

		target['layers'].addLayer(newLayer);
		target['layers'].setActiveLayer(layer.id);

		target.getBus().emit('layer::create::response', {
			id: layer.id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});

		target.getBus().emit('layer::change_active::response', { id: layer.id });
		target['proxyLayerEvents'](newLayer);
	}

	revert(action: LayerCreateAndActivateAction, target: LayersManager): void {
		target['layers'].removeLayer(action.after.activeKey);
		target['layers'].setActiveLayer(action.before.activeKey);

		target.getBus().emit('layer::change_active::response', { id: action.before.activeKey });
		target.getBus().emit('layer::remove::response', { id: action.after.activeKey });
	}
}
