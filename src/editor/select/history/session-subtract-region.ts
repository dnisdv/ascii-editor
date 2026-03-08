import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction
} from '@editor/history-manager';
import type { SessionSnapshot } from '../session/selection-session';
import type { SelectionSessionManager } from '../session/selection-session-manager';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import type { SmartObjectSerializableSchemaType } from '@editor/serializer/smart-object.schema';
import {
	captureGridSnapshots,
	restoreGridSnapshots,
	type GridRegionSnapshot
} from './history-shared';

export interface SubtractedTextContent {
	objectId: string;
	text: string;
	cellX: number;
	cellY: number;
	width: number;
	height: number;
}

export interface ModifiedTextObject {
	objectId: string;
	before: {
		text: string;
		cellX: number;
		cellY: number;
		width: number;
		height: number;
	};
	after: {
		text: string;
		cellX: number;
		cellY: number;
		width: number;
		height: number;
	} | null;
}

interface NewTextObject {
	text: string;
	cellX: number;
	cellY: number;
	width: number;
	height: number;
}

export interface CapturedObjectState {
	snapshot: SmartObjectSerializableSchemaType;
	layerId: string;
	index: number;
}

export const sessionSubtractRegion = createActionDefinition<
	'select::session_subtract_region',
	{
		subtractedTextObjects: SubtractedTextContent[];
		modifiedTextObjects: ModifiedTextObject[];
		subtractedSmartObjectsIds: string[];
		addedTextObjects?: NewTextObject[];
	},
	void
>('select::session_subtract_region');

export interface SessionSubtractRegionAction extends BaseAction {
	type: typeof sessionSubtractRegion.type;
	before: {
		session: SessionSnapshot;
		overwrittenContent?: GridRegionSnapshot[];
	};
	after: {
		session: SessionSnapshot;
		subtractedTextContent?: SubtractedTextContent[];
		subtractedSmartObjectsIds?: string[];
	};
}

export class SessionSubtractRegion
	implements
		ActionHandler<
			SessionSubtractRegionAction,
			typeof sessionSubtractRegion._result,
			typeof sessionSubtractRegion._payload
		>
{
	private captureOverwrittenContent(
		subtractedObjects: SubtractedTextContent[],
		target: SelectionSessionManager
	): GridRegionSnapshot[] {
		const activeSession = target.getActiveSession();
		if (!activeSession) return [];

		const sourceLayerId = activeSession.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');

		if (!sourceLayer) return [];

		return captureGridSnapshots(sourceLayer, subtractedObjects);
	}

	private updateSessionTextObjects(
		target: SelectionSessionManager,
		modifiedObjects: ModifiedTextObject[]
	): void {
		const session = target.getActiveSession();
		if (!session) return;

		modifiedObjects.forEach((mod) => {
			const selectedObjects = session.getSelectedObjects();
			const objToUpdate = selectedObjects.find((obj) => obj.id === mod.objectId);

			if (!objToUpdate) return;

			if (mod.after === null) {
				session.removeObjects([mod.objectId]);
				return;
			}

			const updatedObj = new TextSelectionObject(
				{
					cellX: mod.after.cellX,
					cellY: mod.after.cellY,
					width: mod.after.width,
					height: mod.after.height
				},
				mod.after.text
			);
			updatedObj.id = mod.objectId;
			session.replaceObject(mod.objectId, updatedObj);
		});
	}

	private clearSmartObjectsFromSession(target: SelectionSessionManager, objectIds: string[]): void {
		const session = target.getActiveSession();
		if (!session || objectIds.length === 0) return;

		session.removeObjectsFromTemp(objectIds);
	}

	private writeOrReplaceSmartObjectsToLayer(
		target: SelectionSessionManager,
		orderKeys: Record<string, string>,
		subtractedObjects: string[]
	) {
		const session = target.getActiveSession();
		if (!session || subtractedObjects.length === 0) return;

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		subtractedObjects.forEach((objId) => {
			const objectInSession = session.getObjectById(objId);

			if (objectInSession) {
				sourceLayer.addOrReplaceObject(objectInSession, { orderKey: orderKeys[objId] });
			}
		});
	}

	private writeSubtractedTextToLayer(
		target: SelectionSessionManager,
		subtractedObjects: SubtractedTextContent[]
	): void {
		const session = target.getActiveSession();
		if (!session || subtractedObjects.length === 0) return;

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		subtractedObjects.forEach((obj) => {
			sourceLayer.grid.setToRegion(obj.cellX, obj.cellY, obj.text, { skipSpaces: true });
		});
	}

	private addNewTextObjectsToSession(
		target: SelectionSessionManager,
		addedObjects: NewTextObject[]
	): void {
		const session = target.getActiveSession();
		if (!session || !addedObjects || addedObjects.length === 0) return;

		const newSelectionObjects = addedObjects.map(
			(o) =>
				new TextSelectionObject(
					{ cellX: o.cellX, cellY: o.cellY, width: o.width, height: o.height },
					o.text
				)
		);
		session.addObjects(newSelectionObjects);
	}

	private removeSmartObjectsFromLayer(target: SelectionSessionManager, objectIds: string[]): void {
		const session = target.getActiveSession();
		if (!session || objectIds.length === 0) return;

		const sourceLayerId = session.getSourceLayerId();
		const sourceLayer = target.getLayersManager().getLayer(sourceLayerId || '');
		if (!sourceLayer) return;

		objectIds.forEach((objId) => {
			sourceLayer.removeObject(objId);
		});
	}

	execute(
		target: SelectionSessionManager,
		_context: unknown,
		payload: typeof sessionSubtractRegion._payload
	): [SessionSubtractRegionAction | undefined, void | undefined] {
		const active = target.getActiveSession();
		if (!active) return [undefined, undefined];

		const snapshotBefore = target.serializeActiveSession();
		if (!snapshotBefore) return [undefined, undefined];

		if (!payload) return [undefined, undefined];

		const orderKeys = snapshotBefore.orderKeys;

		const overwrittenContent = this.captureOverwrittenContent(
			payload.subtractedTextObjects || [],
			target
		);

		this.writeOrReplaceSmartObjectsToLayer(
			target,
			orderKeys,
			payload.subtractedSmartObjectsIds || []
		);
		this.updateSessionTextObjects(target, payload.modifiedTextObjects || []);
		this.clearSmartObjectsFromSession(target, payload.subtractedSmartObjectsIds || []);
		this.writeSubtractedTextToLayer(target, payload.subtractedTextObjects || []);
		this.addNewTextObjectsToSession(target, payload.addedTextObjects || []);

		const snapshotAfter = target.serializeActiveSession();
		if (!snapshotAfter) return [undefined, undefined];

		const shouldEndSession = (snapshotAfter.selectedObjects?.length ?? 0) === 0;
		if (shouldEndSession) {
			target.commitActiveSession();
		}

		return [
			{
				type: sessionSubtractRegion.type,
				targetId: 'select::session',
				before: {
					session: snapshotBefore,
					overwrittenContent
				},
				after: {
					session: shouldEndSession ? (null as unknown as SessionSnapshot) : snapshotAfter,
					subtractedTextContent: payload.subtractedTextObjects,
					subtractedSmartObjectsIds: payload.subtractedSmartObjectsIds
				}
			},
			undefined
		];
	}

	apply(action: SessionSubtractRegionAction, target: SelectionSessionManager): void {
		const subtractedContent = action.after.subtractedTextContent || [];
		this.writeSubtractedTextToLayer(target, subtractedContent || []);

		const orderKeys = action.before.session.orderKeys || {};
		this.writeOrReplaceSmartObjectsToLayer(
			target,
			orderKeys,
			action.after.subtractedSmartObjectsIds || []
		);

		const nextSession = (action.after.session as unknown as SessionSnapshot | null) ?? null;
		target.restoreSession(nextSession);
	}

	revert(action: SessionSubtractRegionAction, target: SelectionSessionManager): void {
		target.restoreSession(action.before.session);

		const overwrittenContent = action.before.overwrittenContent || [];
		restoreGridSnapshots(overwrittenContent, target.getLayersManager());
	}
}
