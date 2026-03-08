import type { ISmartObject } from '@editor/objects/smart-object.interface';
import { TextSelectionObject } from '@editor/objects/text-selection-object';
import type { SelectionSession } from './selection-session';

export interface ISelectionStrategy {
	select(obj: ISmartObject, options?: { clearRegion?: boolean }): void;
	commit(obj: ISmartObject): void;
	cancel(obj: ISmartObject): void;
	remove(obj: ISmartObject): void;
}

export class DefaultSelectionStrategy implements ISelectionStrategy {
	constructor(private session: SelectionSession) {}

	select(obj: ISmartObject): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerId();
		const targetLayer = this.session.getTargetLayer();
		if (!sourceLayer || !targetLayer || !tempLayerId) return;

		const clone = obj.clone();
		if (targetLayer.getObjectById(clone.id)) return;

		sourceLayer.insertObjectInTempUsingSourceKeyOrTop(tempLayerId, clone);
	}

	commit(obj: ISmartObject): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerId();
		const targetLayer = this.session.getTargetLayer();
		if (!sourceLayer || !targetLayer || !tempLayerId) return;

		const desiredKey = sourceLayer.getOrderKey(obj.id) ?? obj.serialize().orderKey;

		sourceLayer.removeObject(obj.id);
		sourceLayer.addObject(obj, { orderKey: desiredKey });

		targetLayer.removeObject(obj.id);
	}

	cancel(obj: ISmartObject): void {
		const tempLayerId = this.session.getTargetLayerId();
		const targetLayer = this.session.getTargetLayer();
		if (!targetLayer || !tempLayerId) return;
		targetLayer.removeObject(obj.id);
	}

	remove(obj: ISmartObject): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerId();
		const targetLayer = this.session.getTargetLayer();
		if (!targetLayer || !tempLayerId) return;

		if (sourceLayer.getObjectById(obj.id)) {
			sourceLayer.removeObject(obj.id);
		}
		targetLayer.removeObject(obj.id);
	}
}

export class TextSelectionStrategy implements ISelectionStrategy {
	constructor(private session: SelectionSession) {}

	select(obj: ISmartObject, options?: { clearRegion?: boolean }): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerIdForObject(obj);
		const targetLayer = this.session.getTargetLayerForObject(obj);
		if (!sourceLayer || !targetLayer || !tempLayerId) return;

		if (obj instanceof TextSelectionObject) {
			const cellX = obj.getProperty<number>('transform.x');
			const cellY = obj.getProperty<number>('transform.y');
			const width = obj.getProperty<number>('transform.width');
			const height = obj.getProperty<number>('transform.height');

			if (options?.clearRegion !== false) {
				sourceLayer.grid.clearRegion(cellX, cellY, width, height);
			}

			if (targetLayer.getObjectById(obj.id)) return;

			targetLayer.addOrReplaceObject(obj);

			if (sourceLayer.getObjectById(obj.id)) {
				sourceLayer.removeObject(obj.id);
			}
		}
	}

	commit(obj: ISmartObject): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerIdForObject(obj);
		const targetLayer = this.session.getTargetLayerForObject(obj);
		if (!sourceLayer || !targetLayer || !tempLayerId) return;

		if (obj instanceof TextSelectionObject) {
			const cellX = obj.getProperty<number>('transform.x');
			const cellY = obj.getProperty<number>('transform.y');
			sourceLayer.grid.setToRegion(cellX, cellY, obj.selectedText);
		}

		targetLayer.removeObject(obj.id);
	}

	cancel(obj: ISmartObject): void {
		const tempLayerId = this.session.getTargetLayerIdForObject(obj);
		const targetLayer = this.session.getTargetLayerForObject(obj);
		if (!targetLayer || !tempLayerId) return;
		targetLayer.removeObject(obj.id);
	}

	remove(obj: ISmartObject): void {
		const sourceLayer = this.session.getSourceLayer();
		const tempLayerId = this.session.getTargetLayerIdForObject(obj);
		const targetLayer = this.session.getTargetLayerForObject(obj);
		if (!sourceLayer || !targetLayer || !tempLayerId) return;

		if (obj instanceof TextSelectionObject) {
			const cellX = obj.getProperty<number>('transform.x');
			const cellY = obj.getProperty<number>('transform.y');
			const width = obj.getProperty<number>('transform.width');
			const height = obj.getProperty<number>('transform.height');

			sourceLayer.grid.clearRegion(cellX, cellY, width, height);
		}

		targetLayer.removeObject(obj.id);
	}
}

export class SelectionStrategyFactory {
	private defaultStrategy: DefaultSelectionStrategy;
	private textStrategy: TextSelectionStrategy;

	constructor(session: SelectionSession) {
		this.defaultStrategy = new DefaultSelectionStrategy(session);
		this.textStrategy = new TextSelectionStrategy(session);
	}

	getStrategy(obj: ISmartObject): ISelectionStrategy {
		if (obj.type === 'text-selection') {
			return this.textStrategy;
		}
		return this.defaultStrategy;
	}
}
