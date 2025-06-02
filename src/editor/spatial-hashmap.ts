import type { ISpatialHashMap } from './types';

export class SpatialHashMap<T> implements ISpatialHashMap<T> {
	private map: Map<string, T[]> = new Map();

	private createKey(x: number, y: number): string {
		return `${Math.floor(x)},${Math.floor(y)}`;
	}

	add(x: number, y: number, item: T): void {
		const key = this.createKey(x, y);
		const items = this.map.get(key);

		if (items) {
			const exists = items.some(
				(existingItem) => JSON.stringify(existingItem) === JSON.stringify(item)
			);
			if (!exists) {
				items.push(item);
			}
		} else {
			this.map.set(key, [item]);
		}
	}

	query(x: number, y: number, width: number, height: number): T[] {
		const result: Set<T> = new Set();

		for (let queryX = x; queryX <= x + width; queryX++) {
			for (let queryY = y; queryY <= y + height; queryY++) {
				const key = this.createKey(queryX, queryY);
				const items = this.map.get(key);
				if (items) {
					items.forEach((item) => result.add(item));
				}
			}
		}
		return Array.from(result);
	}

	queryAll(): T[] {
		const result: Set<T> = new Set();
		for (const items of this.map.values()) {
			items.forEach((item) => result.add(item));
		}
		return Array.from(result);
	}

	remove(x: number, y: number): void {
		const key = this.createKey(x, y);
		this.map.delete(key);
	}

	serialize(): string {
		return JSON.stringify(
			[...this.map.entries()].map(([key, values]) => {
				const [x, y] = key.split(',').map(Number);
				return [x, y, values];
			})
		);
	}

	deserialize(data: string): void {
		const parsed = JSON.parse(data);
		this.map = new Map(
			parsed.map(([x, y, values]: [number, number, T[]]) => [`${x},${y}`, values])
		);
	}
}
