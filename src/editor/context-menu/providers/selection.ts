import type { ContextMenuList, MenuContext } from '../context-menu.interface';
import type { ContextMenuProvider } from '../context-menu.service';
import { MenuGroup, MenuId, getShortcutDisplay } from '../constants';
import { menu } from '../menu-factory';
import { LabelKey } from '../labels';

export function createSelectionProvider(): ContextMenuProvider {
	return {
		id: 'provider.selection',
		when: (ctx: MenuContext) =>
			ctx.target === 'selection' &&
			(ctx.selectedCount ?? 0) > 0 &&
			Array.isArray(ctx.data?.selectedObjects),
		getItems: (ctx: MenuContext): ContextMenuList => {
			const selectedObjects = (ctx.data?.selectedObjects || []) as { type: string }[];
			const hasTextSelection = selectedObjects.some((obj) => obj.type === 'text-selection');

			const items: ContextMenuList = [
				menu.command(MenuId.ClipboardCut, {
					labelKey: LabelKey.ClipboardCut,
					shortcut: getShortcutDisplay(MenuId.ClipboardCut),
					priority: 200,
					group: MenuGroup.Clipboard
				}),
				menu.command(MenuId.ClipboardCopy, {
					labelKey: LabelKey.ClipboardCopy,
					shortcut: getShortcutDisplay(MenuId.ClipboardCopy),
					priority: 199,
					group: MenuGroup.Clipboard
				}),
				menu.command(MenuId.ClipboardPaste, {
					labelKey: LabelKey.ClipboardPaste,
					shortcut: getShortcutDisplay(MenuId.ClipboardPaste),
					priority: 198,
					group: MenuGroup.Clipboard
				}),
				menu.command(MenuId.ClipboardDuplicate, {
					labelKey: LabelKey.ClipboardDuplicate,
					shortcut: getShortcutDisplay(MenuId.ClipboardDuplicate),
					priority: 197,
					group: MenuGroup.Clipboard
				}),

				menu.separator()
			];

			if (!hasTextSelection) {
				items.push(
					menu.command(MenuId.ArrangeBringToFront, {
						labelKey: LabelKey.ArrangeBringToFront,
						shortcut: getShortcutDisplay(MenuId.ArrangeBringToFront),
						priority: 150,
						group: MenuGroup.Arrange
					}),
					menu.command(MenuId.ArrangeBringForward, {
						labelKey: LabelKey.ArrangeBringForward,
						shortcut: getShortcutDisplay(MenuId.ArrangeBringForward),
						priority: 149,
						group: MenuGroup.Arrange
					}),
					menu.command(MenuId.ArrangeSendBackward, {
						labelKey: LabelKey.ArrangeSendBackward,
						shortcut: getShortcutDisplay(MenuId.ArrangeSendBackward),
						priority: 148,
						group: MenuGroup.Arrange
					}),
					menu.command(MenuId.ArrangeSendToBack, {
						labelKey: LabelKey.ArrangeSendToBack,
						shortcut: getShortcutDisplay(MenuId.ArrangeSendToBack),
						priority: 147,
						group: MenuGroup.Arrange
					})
				);
			}

			items.push(menu.separator());

			items.push(
				menu.command(MenuId.SelectionDelete, {
					labelKey: LabelKey.SelectionDelete,
					shortcut: getShortcutDisplay(MenuId.SelectionDelete),
					priority: 1,
					group: MenuGroup.Destroy
				})
			);

			const hasRasterizable = selectedObjects.some(
				(obj) => obj.type !== 'text-grid' && obj.type !== 'text-selection'
			);
			if (hasRasterizable) {
				items.push(
					menu.command(MenuId.LayerRasterize, {
						labelKey: LabelKey.LayerRasterize,
						priority: 50,
						group: MenuGroup.Object
					})
				);
			}

			items.push(menu.separator());

			return items;
		}
	};
}
