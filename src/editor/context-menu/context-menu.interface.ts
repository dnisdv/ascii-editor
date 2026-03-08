export type MenuItemKind = 'command' | 'toggle' | 'radio' | 'submenu' | 'separator';

export type Shortcut = string;

export interface MenuContext {
	target: 'canvas' | 'selection' | 'object' | 'layer-panel' | 'other';
	selectedCount?: number;
	data?: Record<string, unknown>;
}

export interface BaseMenuItem {
	id?: string;
	kind: MenuItemKind;
	labelKey?: string;
	label?: string;
	icon?: string;
	shortcut?: Shortcut;
	visible?: boolean;
	enabled?: boolean;
	priority?: number;
	group?: string;
}

export interface CommandMenuItem extends BaseMenuItem {
	kind: 'command';
	commandId: string;
	args?: unknown;
	onSelect?: () => void;
}

export interface ToggleMenuItem extends BaseMenuItem {
	kind: 'toggle';
	checked?: boolean | 'mixed';
	commandId?: string;
	args?: unknown;
	onToggle?: (next: boolean) => void;
}

export interface RadioMenuItem extends BaseMenuItem {
	kind: 'radio';
	groupId: string;
	value: string;
	selected?: boolean;
	commandId?: string;
	args?: unknown;
	onSelect?: () => void;
}

export interface SubmenuMenuItem extends BaseMenuItem {
	kind: 'submenu';
	items: MenuItem[];
}

export interface SeparatorMenuItem extends BaseMenuItem {
	kind: 'separator';
}

export type MenuItem =
	| CommandMenuItem
	| ToggleMenuItem
	| RadioMenuItem
	| SubmenuMenuItem
	| SeparatorMenuItem;

export type ContextMenuList = MenuItem[];
