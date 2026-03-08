import type { ContextMenuList, MenuContext } from '../context-menu.interface';
import type { ContextMenuProvider } from '../context-menu.service';
import { MenuGroup, MenuId, getShortcutDisplay } from '../constants';
import { menu } from '../menu-factory';
import { LabelKey } from '../labels';

export function createGlobalContextMenuProvider(): ContextMenuProvider {
	return {
		id: 'provider.global',
		when: (ctx: MenuContext) =>
			(ctx.target === 'canvas' || ctx.target === 'other') && (ctx.selectedCount ?? 0) === 0,
		getItems: (): ContextMenuList => [
			menu.command(MenuId.ClipboardPaste, {
				labelKey: LabelKey.ClipboardPaste,
				shortcut: getShortcutDisplay(MenuId.ClipboardPaste),
				priority: 200,
				group: MenuGroup.Clipboard
			}),
			menu.command(MenuId.SelectAll, {
				labelKey: LabelKey.SelectAll,
				shortcut: getShortcutDisplay(MenuId.SelectAll),
				priority: 190,
				group: MenuGroup.Selection
			}),

			menu.separator(),

			menu.command(MenuId.ViewToggleUI, {
				labelKey: LabelKey.ViewToggleUI,
				shortcut: getShortcutDisplay(MenuId.ViewToggleUI),
				priority: 100,
				group: MenuGroup.View
			}),
			menu.command(MenuId.ViewToggleGrid, {
				labelKey: LabelKey.ViewToggleGrid,
				shortcut: getShortcutDisplay(MenuId.ViewToggleGrid),
				group: MenuGroup.View
			}),

			menu.separator(),

			menu.submenu(
				MenuId.ViewTheme,
				LabelKey.ViewTheme,
				[
					menu.radio(MenuId.ViewThemeLight, {
						groupId: 'theme',
						value: 'light',
						labelKey: LabelKey.ViewThemeLight,
						selected: true,
						commandId: MenuId.ViewThemeSet,
						args: { theme: 'light' }
					}),
					menu.radio(MenuId.ViewThemeDark, {
						groupId: 'theme',
						value: 'dark',
						labelKey: LabelKey.ViewThemeDark,
						selected: false,
						commandId: MenuId.ViewThemeSet,
						args: { theme: 'dark' }
					})
				],
				{ group: MenuGroup.View }
			)
		]
	};
}
