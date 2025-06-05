import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/types';
import type { LayersManager } from '../layers-manager';

export interface LayerRemoveAction extends BaseAction {
	type: 'layers::remove';
	before: { layer: LayerSerializableSchemaType };
	after: { layer: null };
}

export class LayerRemove implements ActionHandler<LayerRemoveAction> {
	apply(action: LayerRemoveAction, target: LayersManager): void {
		const { layer } = action.before;
		target['layers'].removeLayer(layer.id);
		target.getBus().emit('layer::remove::response', { id: layer.id });
		target.getBus().emit('layer::change_active::response', { id: layer.id });
	}

	revert(action: LayerRemoveAction, target: LayersManager): void {
		const { layer } = action.before;
		const newLayer = target.deserializeLayer(layer);
		target['layers'].insertLayerAtIndex(newLayer, layer.index);
		target['layers'].setActiveLayer(layer.id);

		target.getBus().emit('layer::change_active::response', { id: layer.id });
		target.getBus().emit('layer::create::response', {
			id: layer.id,
			name: layer.name,
			index: layer.index,
			opts: layer.opts
		});
		target['proxyLayerEvents'](newLayer);
	}
}
