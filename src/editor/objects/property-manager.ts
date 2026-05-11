import type { ObjectOperation } from '@editor/types';
import type { Properties } from './properties';
import { deepMerge } from '@editor/utils/object';

const getDeepValue = (obj: unknown, path: string): unknown => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return path.split('.').reduce((acc: any, part) => acc && acc[part], obj);
};


const setDeepValue = (obj: unknown, path: string, value: unknown) => {
	const keys = path.split('.');
	const lastKey = keys.pop();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const target = keys.reduce((acc: any, part) => {
		if (acc) {
			acc[part] = acc[part] || {};
			return acc[part];
		}
	}, obj);

	if (target && lastKey) {
		target[lastKey] = value;
	}
};

export class PropertyManager<P extends Properties> {
	private staged: Map<string, unknown> = new Map();

	constructor(
		private values: P,
		private onOps: (ops: ObjectOperation[]) => void,
		private onVisualChange?: () => void
	) {}

	public get(path: string): unknown {
		if (this.staged.has(path)) return this.staged.get(path);
		return getDeepValue(this.values, `${path}.value`);
	}

	public getCommitted(path: string): unknown {
		return getDeepValue(this.values, `${path}.value`);
	}

	public getVisual(path: string): unknown | undefined {
		return this.staged.get(path);
	}

	public listVisualKeys(): string[] {
		return Array.from(this.staged.keys());
	}

	public hasVisual(path: string): boolean {
		return this.staged.has(path);
	}

	public set(path: string, value: unknown): void {
		setDeepValue(this.values, `${path}.value`, value);
		this.onOps([{ op: 'replace', path: `${path}.value`, value }]);
	}

	public setVisual(path: string, value: unknown): void {
		const prev = this.staged.get(path);
		if (prev === value) return;
		this.staged.set(path, value);
		this.onVisualChange?.();
	}

	public commit(paths?: string[]): void {
		const keys = paths ? paths.filter((p) => this.staged.has(p)) : Array.from(this.staged.keys());
		if (keys.length === 0) return;

		const changes: { path: string; before: unknown; after: unknown }[] = [];
		for (const path of keys) {
			const after = this.staged.get(path);
			const before = getDeepValue(this.values, `${path}.value`);
			changes.push({ path, before, after });
		}

		const ops: ObjectOperation[] = [];
		for (const { path, after } of changes) {
			setDeepValue(this.values, `${path}.value`, after);
			ops.push({ op: 'replace', path: `${path}.value`, value: after });
			this.staged.delete(path);
		}
		if (ops.length) this.onOps(ops);
		this.onVisualChange?.();
	}

	public discard(paths?: string[]): void {
		if (!paths) {
			if (this.staged.size === 0) return;
			this.staged.clear();
			this.onVisualChange?.();
			return;
		}
		let changed = false;
		for (const p of paths) {
			if (this.staged.delete(p)) changed = true;
		}
		if (changed) this.onVisualChange?.();
	}

	public commitAll(): void {
		this.commit();
	}
	public discardAll(): void {
		this.discard();
	}

	public applyCommitted(path: string, value: unknown): void {
		setDeepValue(this.values, `${path}.value`, value);
		this.onOps([{ op: 'replace', path: `${path}.value`, value }]);
	}

	public snapshot(): P {
		return JSON.parse(JSON.stringify({ ...this.values }));
	}

	public setFromSnapshot(snapshot: P): void {
		this.values = deepMerge(this.values, snapshot) as P;
	}
}
