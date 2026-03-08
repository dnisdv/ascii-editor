import type { ISmartObject } from '@editor/objects/smart-object.interface';
import {
	compareFractionalIndex,
	generateKeyBetween,
	generateKeyForIndex,
	resolveCollision
} from '@editor/utils/fractional-index';

export type ObjectListMode = 'dense' | 'sparse';
export type ObjectPosition = number | { index?: number; orderKey?: string };

export class ObjectListManager<T extends ISmartObject> {
	private objectsById: Map<string, T> = new Map();
	private orderKeys: Map<string, string> = new Map();
	private lastAutoKeyFromTop: string | null = null;

	private cachedSortedIds: string[] | null = null;

	private onAdd: (object: T, toIndex: number) => void;
	private onRemove: (object: T) => void;
	private onChange: () => void;
	private onMove: (id: string, toIndex: number) => void;
	private onObjectOperation: (object: T, data: unknown) => void;
	private onObjectUpdate: (object: T) => void;

	private eventUnsubscribers: Map<string, () => void> = new Map();

	constructor(
		initialObjects: T[] = [],
		initialOrderKeys?: Record<string, string>,
		callbacks?: {
			onAdd?: (object: T, toIndex: number) => void;
			onRemove?: (object: T) => void;
			onObjectOperation?: (object: T, data: unknown) => void;
			onObjectUpdate?: (object: T) => void;
			onChange?: () => void;
			onMove?: (id: string, toIndex: number) => void;
		},
		_mode: ObjectListMode = 'dense'
	) {
		this.onAdd = callbacks?.onAdd ?? (() => {});
		this.onRemove = callbacks?.onRemove ?? (() => {});
		this.onObjectOperation = callbacks?.onObjectOperation ?? (() => {});
		this.onChange = callbacks?.onChange ?? (() => {});
		this.onMove = callbacks?.onMove ?? (() => {});
		this.onObjectUpdate = callbacks?.onObjectUpdate ?? (() => {});

		void _mode;

		let lastOrderKey: string | null = null;
		for (const obj of initialObjects) {
			if (this.objectsById.has(obj.id)) continue;

			const existingKey = initialOrderKeys ? initialOrderKeys[obj.id] : undefined;
			const newOrderKey: string = existingKey || generateKeyBetween(lastOrderKey, null);

			lastOrderKey = newOrderKey;

			this.objectsById.set(obj.id, obj);
			this.orderKeys.set(obj.id, newOrderKey);

			this.subscribeToObjectEvents(obj);
			this.onAdd(obj, this.getIndexOf(obj.id));
		}

		this.cachedSortedIds = null;

		if (initialObjects.length > 0) {
			this.onChange();
		}
	}

	private subscribeToObjectEvents(object: T): void {
		const operationHandler = (data: unknown) => {
			this.onObjectOperation(object, data);
		};

		const updateHandler = () => {
			this.onObjectUpdate(object);
		};
		object.on('op', operationHandler);
		object.on('update', updateHandler);

		this.eventUnsubscribers.set(object.id, () => {
			object.off('op', operationHandler);
			object.off('update', updateHandler);
		});
	}

	private unsubscribeFromObjectEvents(id: string): void {
		const unsubscribe = this.eventUnsubscribers.get(id);
		if (unsubscribe) {
			unsubscribe();
			this.eventUnsubscribers.delete(id);
		}
	}

	private getSortedIds(excludeId?: string): string[] {
		if (this.cachedSortedIds && !excludeId) {
			return this.cachedSortedIds;
		}

		const sorted = Array.from(this.orderKeys.entries())
			.sort(([, a], [, b]) => compareFractionalIndex(a, b))
			.map(([id]) => id);

		if (!excludeId) {
			this.cachedSortedIds = sorted;
		}

		return excludeId ? sorted.filter((id) => id !== excludeId) : sorted;
	}

	private getNeighborsForIndex(
		index: number | undefined,
		excludeId?: string
	): { prev: string | null; next: string | null } {
		const ids = this.getSortedIds(excludeId);
		const clampedIndex = Math.max(0, Math.min(index ?? ids.length, ids.length));

		const prevId = ids[clampedIndex - 1];
		const nextId = ids[clampedIndex];

		return {
			prev: prevId ? (this.orderKeys.get(prevId) ?? null) : null,
			next: nextId ? (this.orderKeys.get(nextId) ?? null) : null
		};
	}

	private generateOrderKey(position: ObjectPosition | undefined, excludeId?: string): string {
		const desiredOrderKey =
			typeof position === 'object' && position !== null ? position.orderKey : undefined;

		const sortedIds = this.getSortedIds(excludeId);
		const index = typeof position === 'number' ? position : (position?.index ?? sortedIds.length);

		if (position === undefined) {
			if (this.lastAutoKeyFromTop === null) {
				this.lastAutoKeyFromTop = generateKeyBetween(null, null);
			}
			const nextKey = generateKeyBetween(null, this.lastAutoKeyFromTop);
			this.lastAutoKeyFromTop = nextKey;
			return nextKey;
		}

		if (desiredOrderKey) {
			if (!this.isOrderKeyTaken(desiredOrderKey, excludeId)) {
				return desiredOrderKey;
			}
			const ids = this.getSortedIds(excludeId);
			let lower: string | null = null;
			let upper: string | null = null;
			let equalKeyOwnerId: string | null = null;
			for (const id of ids) {
				const key = this.orderKeys.get(id)!;
				if (key === desiredOrderKey) {
					equalKeyOwnerId = id;
				}
				if (compareFractionalIndex(key, desiredOrderKey) < 0) {
					lower = key;
				} else if (compareFractionalIndex(desiredOrderKey, key) < 0) {
					upper = key;
					break;
				}
			}
			if (equalKeyOwnerId) {
				const sorted = this.getSortedIds(excludeId);
				const idx = sorted.indexOf(equalKeyOwnerId);
				const nextId = sorted[idx + 1];
				lower = this.orderKeys.get(equalKeyOwnerId) ?? null;
				upper = nextId ? (this.orderKeys.get(nextId) ?? null) : null;
			}
			let candidate = generateKeyBetween(lower, upper);
			let guard = 0;
			while (this.isOrderKeyTaken(candidate, excludeId) && guard < 64) {
				lower = candidate;
				let nextCandidate = generateKeyBetween(lower, upper);
				if (nextCandidate === lower) {
					nextCandidate = lower + 'V';
				}
				candidate = nextCandidate;
				guard++;
			}
			return candidate;
		}

		const sortedKeys = this.getSortedIds(excludeId)
			.map((id) => this.orderKeys.get(id)!)
			.filter(Boolean);
		const generatedKey = generateKeyForIndex(
			index,
			this.getSortedIds(excludeId),
			(id) => this.orderKeys.get(id),
			excludeId
		);
		if (!this.isOrderKeyTaken(generatedKey, excludeId)) return generatedKey;
		return resolveCollision(generatedKey, sortedKeys);
	}

	private isOrderKeyTaken(orderKey: string, excludeId?: string): boolean {
		for (const [id, key] of this.orderKeys.entries()) {
			if (id === excludeId) continue;
			if (key === orderKey) return true;
		}
		return false;
	}

	public get(id: string): T | undefined {
		return this.objectsById.get(id);
	}

	public has(id: string): boolean {
		return this.objectsById.has(id);
	}

	public getOrderKey(id: string): string | undefined {
		return this.orderKeys.get(id);
	}

	public add(object: T, position?: ObjectPosition): void {
		if (this.objectsById.has(object.id)) {
			console.warn(`Object with ID "${object.id}" already exists.`);
			return;
		}

		this.objectsById.set(object.id, object);
		this.subscribeToObjectEvents(object);

		const orderKey = this.generateOrderKey(position);
		this.orderKeys.set(object.id, orderKey);
		this.cachedSortedIds = null;

		const finalIndex = this.getIndexOf(object.id);
		this.onAdd(object, finalIndex);
		this.onChange();
	}

	public remove(id: string): T | undefined {
		const objectToRemove = this.objectsById.get(id);

		if (objectToRemove) {
			this.unsubscribeFromObjectEvents(id);
			this.objectsById.delete(id);
			this.orderKeys.delete(id);
			this.cachedSortedIds = null;

			this.onRemove(objectToRemove);
			this.onChange();
		}

		return objectToRemove;
	}

	public updateIndex(id: string, newIndex: number): void {
		if (!this.objectsById.has(id)) {
			console.warn(`Object with ID "${id}" not found for reordering.`);
			return;
		}

		const currentIndex = this.getIndexOf(id);
		if (currentIndex === newIndex) return;

		const orderKey = this.generateOrderKey(newIndex, id);
		this.orderKeys.set(id, orderKey);
		this.cachedSortedIds = null;

		const finalIndex = this.getIndexOf(id);
		this.onMove(id, finalIndex);
		this.onChange();
	}

	public getIndexOf(id: string): number {
		const ids = this.getSortedIds();
		return ids.indexOf(id);
	}

	public clear(shouldKeep?: (object: T) => boolean): void {
		const allObjectIds = this.getSortedIds();

		for (const id of allObjectIds) {
			const object = this.get(id);
			if (object && (!shouldKeep || !shouldKeep(object))) {
				this.remove(id);
			}
		}
	}

	public getAll(): T[] {
		return this.getSortedIds()
			.map((id) => this.objectsById.get(id))
			.filter(Boolean) as T[];
	}

	public get size(): number {
		return this.objectsById.size;
	}
}
