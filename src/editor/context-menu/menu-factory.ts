import type {
	CommandMenuItem,
	ContextMenuList,
	RadioMenuItem,
	SeparatorMenuItem,
	SubmenuMenuItem,
	ToggleMenuItem
} from './context-menu.interface';
import type { MenuGroupKey } from './constants';
import type { LabelKeyType } from './labels';
import { MenuId, type MenuIdKey } from './constants';

type CommonOpts = {
	labelKey?: LabelKeyType | string;
	label?: string;
	icon?: string;
	shortcut?: string;
	enabled?: boolean;
	visible?: boolean;
	priority?: number;
	group?: MenuGroupKey;
};

type CommandOpts = CommonOpts & {
	commandId?: MenuIdKey;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	args?: any;
	onSelect?: () => void;
};

type ToggleOpts = CommonOpts & {
	checked?: boolean | 'mixed';
	commandId?: MenuIdKey;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	args?: any;
	onToggle?: (next: boolean) => void;
};

type RadioOpts = CommonOpts & {
	groupId: string;
	value: string;
	selected?: boolean;
	commandId?: MenuIdKey;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	args?: any;
	onSelect?: () => void;
};

type SubmenuOpts = CommonOpts & {};

export const menu = {
	command(id: MenuIdKey, opts: CommandOpts = {}): CommandMenuItem {
		const {
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			commandId = id,
			args,
			onSelect
		} = opts;
		return {
			kind: 'command',
			id,
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			commandId,
			args,
			onSelect
		};
	},

	toggle(id: MenuIdKey, opts: ToggleOpts = {}): ToggleMenuItem {
		const {
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			checked,
			commandId = id,
			args,
			onToggle
		} = opts;
		return {
			kind: 'toggle',
			id,
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			checked,
			commandId,
			args,
			onToggle
		};
	},

	radio(id: MenuIdKey, opts: RadioOpts): RadioMenuItem {
		const {
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			groupId,
			value,
			selected,
			commandId = id,
			args,
			onSelect
		} = opts;
		return {
			kind: 'radio',
			id,
			labelKey,
			label,
			icon,
			shortcut,
			enabled,
			visible,
			priority,
			group,
			groupId,
			value,
			selected,
			commandId,
			args,
			onSelect
		};
	},

	submenu(
		id: MenuIdKey,
		labelOrKey: string,
		items: ContextMenuList,
		opts: SubmenuOpts = {}
	): SubmenuMenuItem {
		const { icon, shortcut, enabled, visible, priority, group } = opts;
		const isKey = labelOrKey.includes('.');
		return isKey
			? {
					kind: 'submenu',
					id,
					labelKey: labelOrKey,
					icon,
					shortcut,
					enabled,
					visible,
					priority,
					group,
					items
				}
			: {
					kind: 'submenu',
					id,
					label: labelOrKey,
					icon,
					shortcut,
					enabled,
					visible,
					priority,
					group,
					items
				};
	},

	separator(): SeparatorMenuItem {
		return { kind: 'separator' };
	},

	group(items: ContextMenuList, group: MenuGroupKey): ContextMenuList {
		return items.map((it) => (it.kind === 'separator' ? it : { ...it, group }));
	}
};

export const common = {
	commit(group: MenuGroupKey = 'selection', priority = 100): CommandMenuItem {
		return menu.command(MenuId.ObjectCommit, { labelKey: 'menu.object.commit', group, priority });
	},
	cancel(group: MenuGroupKey = 'selection', priority = 99): CommandMenuItem {
		return menu.command(MenuId.ObjectCancel, { labelKey: 'menu.object.cancel', group, priority });
	}
};
