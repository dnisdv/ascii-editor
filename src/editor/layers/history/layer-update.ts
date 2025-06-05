import type { ActionHandler, BaseAction } from '@editor/history-manager';
import type { LayerSerializableSchemaType } from '@editor/types';
import type { LayersManager } from '../layers-manager';

export interface LayerUpdateAction extends BaseAction {
	type: 'layer::update';
	before: LayerSerializableSchemaType;
	after: LayerSerializableSchemaType;
}

export class LayerUpdate implements ActionHandler<LayerUpdateAction> {
	apply(action: LayerUpdateAction, target: LayersManager): void {
		const deserializedLayer = target.deserializeLayer(action.after);

		target['layers'].updateLayer(action.after.id, {
			index: deserializedLayer.index,
			name: deserializedLayer.name,
			opts: deserializedLayer.opts
		});

		target.getBus().emit('layer::update::response', action.after);
	}

	revert(action: LayerUpdateAction, target: LayersManager): void {
		const deserializedLayer = target.deserializeLayer(action.before);

		target['layers'].updateLayer(action.before.id, {
			index: deserializedLayer.index,
			name: deserializedLayer.name,
			opts: deserializedLayer.opts
		});
		target.getBus().emit('layer::update::response', action.before);
	}
}
