import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { LayersManager } from '../layers-manager';
import type { LayersExecutionContext } from './history-context';

export const renameLayerObject = createActionDefinition<
	'layer::rename_object',
	{ layerId: string; objectId: string; name: string },
	void
>('layer::rename_object');

export interface LayerRenameObjectAction extends BaseAction {
	type: typeof renameLayerObject.type;
	before: {
		layerId: string;
		objectId: string;
		name: string | undefined;
	};
	after: {
		layerId: string;
		objectId: string;
		name: string;
	};
}

export class LayerRenameObject
	implements
		ActionHandler<
			LayerRenameObjectAction,
			typeof renameLayerObject._result,
			typeof renameLayerObject._payload
		>
{
	public execute(
		target: LayersManager,
		_context: LayersExecutionContext,
		payload: { layerId: string; objectId: string; name: string }
	): [LayerRenameObjectAction, void] {
		void _context;
		const composition = target.getLayerComposition(payload.layerId);
		if (composition.length === 0)
			throw new Error(`Cannot rename object: Layer with ID "${payload.layerId}" not found.`);

		let beforeName: string | undefined = undefined;
		let renamedAny = false;
		for (const layer of composition) {
			const obj = layer.getObjectById(payload.objectId);
			if (!obj) continue;
			if (!renamedAny) beforeName = obj.getCommittedProperty('meta.name') as string | undefined;

			renamedAny = true;

			obj.properties.applyCommitted('meta.name', payload.name);
			obj.emit('update');
		}

		if (!renamedAny)
			throw new Error(
				`Cannot rename object: Object with ID "${payload.objectId}" not found in layer composition for "${payload.layerId}".`
			);

		return [
			{
				type: renameLayerObject.type,
				targetId: 'layers',
				before: { layerId: payload.layerId, objectId: payload.objectId, name: beforeName },
				after: { layerId: payload.layerId, objectId: payload.objectId, name: payload.name }
			},
			undefined
		];
	}

	public apply(action: LayerRenameObjectAction, target: LayersManager): void {
		const composition = target.getLayerComposition(action.before.layerId);
		for (const layer of composition) {
			const obj = layer.getObjectById(action.after.objectId);
			if (!obj) continue;
			obj.properties.applyCommitted('meta.name', action.after.name);
			obj.emit('update');
		}
	}

	public revert(action: LayerRenameObjectAction, target: LayersManager): void {
		const composition = target.getLayerComposition(action.before.layerId);
		for (const layer of composition) {
			const obj = layer.getObjectById(action.before.objectId);
			if (!obj) continue;
			obj.properties.applyCommitted('meta.name', action.before.name);
			obj.emit('update');
		}
	}
}
