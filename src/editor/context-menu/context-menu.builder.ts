import type {
	ContextMenuList,
	MenuItem,
	ToggleMenuItem,
	SubmenuMenuItem,
	RadioMenuItem
} from './context-menu.interface';

const mergeBooleans = (
	a: boolean | undefined,
	b: boolean | undefined,
	strategy: 'AND' | 'OR'
): boolean | undefined => {
	if (a === undefined) return b;
	if (b === undefined) return a;
	return strategy === 'AND' ? a && b : a || b;
};

const mergeChecked = (
	a: ToggleMenuItem['checked'],
	b: ToggleMenuItem['checked']
): ToggleMenuItem['checked'] => {
	if (a === undefined) return b;
	if (b === undefined) return a;
	if (a === 'mixed' || b === 'mixed') return 'mixed';
	return a === b ? a : 'mixed';
};

const byPriority = (a?: number, b?: number) => (b ?? 0) - (a ?? 0);
const itemKey = (item: MenuItem, index: number) => item.id ?? `__anon_${item.kind}_${index}`;
const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export class ContextMenuBuilder {
	static merge(lists: ContextMenuList[]): ContextMenuList {
		const flat: { key: string; item: MenuItem; index: number }[] = [];
		lists.forEach((list, listIdx) => {
			list.forEach((item, idx) =>
				flat.push({ key: itemKey(item, idx + listIdx * 1000), item, index: idx })
			);
		});

		const order: string[] = [];
		const merged: Record<string, MenuItem> = {};

		for (const { key, item } of flat) {
			if (item.kind === 'separator') {
				order.push(key);
				merged[key] = clone(item);
				continue;
			}

			const id = item.id ?? key;
			if (!merged[id]) {
				order.push(id);
				merged[id] = clone(item);
				continue;
			}

			const existing = merged[id];
			existing.visible = mergeBooleans(existing.visible, item.visible, 'OR');
			existing.enabled = mergeBooleans(existing.enabled, item.enabled, 'AND');

			if (item.priority !== undefined) {
				existing.priority = Math.max(existing.priority ?? Number.MIN_SAFE_INTEGER, item.priority);
			}

			if (existing.kind !== item.kind) {
				existing.enabled = false;
				continue;
			}

			if (existing.kind === 'toggle') {
				const a = existing as ToggleMenuItem;
				const b = item as ToggleMenuItem;
				a.checked = mergeChecked(a.checked, b.checked);
			} else if (existing.kind === 'submenu') {
				const a = existing as SubmenuMenuItem;
				const b = item as SubmenuMenuItem;
				a.items = ContextMenuBuilder.merge([a.items, b.items]);
			} else if (existing.kind === 'radio') {
				const a = existing as RadioMenuItem;
				const b = item as RadioMenuItem;
				a.selected = a.selected || b.selected;
			}
		}

		const items = order.map((id) => merged[id]).filter(Boolean) as MenuItem[];

		const result: MenuItem[] = [];
		let run: MenuItem[] = [];

		const flush = () => {
			if (run.length === 0) return;
			run.sort((a, b) => byPriority(a.priority, b.priority));
			result.push(...run);
			run = [];
		};

		for (const it of items) {
			if (it.kind === 'separator') {
				flush();
				result.push(it);
			} else {
				run.push(it);
			}
		}
		flush();

		const cleaned: MenuItem[] = [];
		for (const it of result) {
			const last = cleaned[cleaned.length - 1];
			if (it.kind === 'separator' && (!last || last.kind === 'separator')) continue;
			cleaned.push(it);
		}

		if (cleaned[0]?.kind === 'separator') cleaned.shift();
		if (cleaned[cleaned.length - 1]?.kind === 'separator') cleaned.pop();

		cleaned.forEach((it) => {
			if (it.visible === undefined) it.visible = true;
			if (it.enabled === undefined) it.enabled = true;
		});

		const GROUP_NONE = '__nogroup__';
		const groupOrder: string[] = [];
		const groupMap: Record<string, MenuItem[]> = {};

		for (const it of cleaned) {
			const g = it.kind === 'separator' ? GROUP_NONE : (it.group ?? GROUP_NONE);
			if (!groupMap[g]) {
				groupMap[g] = [];
				groupOrder.push(g);
			}
			groupMap[g].push(it);
		}

		const grouped: MenuItem[] = [];
		for (const g of groupOrder) {
			const block = groupMap[g];
			if (!block || block.length === 0) continue;
			grouped.push(...block);
			grouped.push({ kind: 'separator' } as MenuItem);
		}

		if (grouped[grouped.length - 1]?.kind === 'separator') grouped.pop();

		const finalItems: MenuItem[] = [];
		for (const it of grouped) {
			const last = finalItems[finalItems.length - 1];
			if (it.kind === 'separator' && (!last || last.kind === 'separator')) continue;
			finalItems.push(it);
		}

		if (finalItems[0]?.kind === 'separator') finalItems.shift();
		if (finalItems[finalItems.length - 1]?.kind === 'separator') finalItems.pop();

		return finalItems;
	}
}
