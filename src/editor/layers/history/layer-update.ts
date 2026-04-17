import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { DeepPartial } from '@editor/types';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';
import type { ILayerModel, LayerConfig } from '@editor/types/external/layer-model';

export const updateLayer = createActionDefinition<
	'layer::update',
	{ id: string; changes: DeepPartial<ILayerModel> },
	void
>('layer::update');

export interface LayerUpdateAction extends BaseAction {
	type: typeof updateLayer.type;
	before: {
		id: string;
		index: number;
		name: string;
		opts: LayerConfig;
		groupId: string | null;
	};
	after: {
		id: string;
		index: number;
		name: string;
		opts: LayerConfig;
		groupId: string | null;
	};
}

export class LayerUpdate
	implements
		ActionHandler<LayerUpdateAction, typeof updateLayer._result, typeof updateLayer._payload>
{
	public execute(
		_: LayersManager,
		context: LayersExecutionContext,
		payload: { id: string; changes: DeepPartial<ILayerModel> }
	): [LayerUpdateAction, void] {
		const { layersListManager } = context;

		let layer = layersListManager.getLayerById(payload.id);
		if (!layer) {
			throw new Error(`Cannot update layer: Layer with ID "${payload.id}" not found.`);
		}

		const before = {
			id: payload.id,
			index: layer.index,
			name: layer.name,
			opts: { ...layer.opts },
			groupId: layer.groupId ?? null
		};

		layersListManager.updateLayer(payload.id, payload.changes);
		layer = layersListManager.getLayerById(payload.id)!;

		const after = {
			id: payload.id,
			index: layer.index,
			name: layer.name,
			opts: { ...layer.opts },
			groupId: layer.groupId ?? null
		};

		return [
			{
				type: updateLayer.type,
				targetId: 'layers',
				before,
				after
			},
			undefined
		];
	}

	apply(action: LayerUpdateAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersListManager.updateLayer(action.after.id, {
			index: action.after.index,
			name: action.after.name,
			opts: action.after.opts,
			groupId: action.after.groupId
		});
	}

	revert(action: LayerUpdateAction, _: LayersManager, context: LayersExecutionContext): void {
		context.layersListManager.updateLayer(action.before.id, {
			index: action.before.index,
			name: action.before.name,
			opts: action.before.opts,
			groupId: action.before.groupId
		});
	}
}
