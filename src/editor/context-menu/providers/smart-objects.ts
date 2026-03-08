import type { ContextMenuList, MenuContext } from '../context-menu.interface';
import type { ISmartObject } from '@editor/objects/smart-object.interface';
import type { ContextMenuProvider } from '../context-menu.service';

type SmartObjectWithSchema = ISmartObject & {
	getContextMenuSchema?: (ctx: MenuContext) => ContextMenuList;
};

function isSchemaProvider(obj: ISmartObject): obj is SmartObjectWithSchema {
	return typeof (obj as SmartObjectWithSchema).getContextMenuSchema === 'function';
}

function normalizeItems(items: ContextMenuList): ContextMenuList {
	return items.map((it) => ({ ...it }));
}

function getObjectMenu(obj: ISmartObject, ctx: MenuContext): ContextMenuList {
	if (!isSchemaProvider(obj)) return [];
	const raw = obj.getContextMenuSchema!(ctx) || [];
	return normalizeItems(raw);
}

export function buildSmartObjectsMenu(objects: ISmartObject[], ctx: MenuContext): ContextMenuList {
	return objects.flatMap((obj) => getObjectMenu(obj, ctx));
}

export function createSmartObjectsProvider(): ContextMenuProvider {
	return {
		id: 'provider.smart-objects',
		when: (ctx: MenuContext) =>
			ctx.target === 'selection' &&
			(ctx.selectedCount ?? 0) > 0 &&
			Array.isArray(ctx.data?.selectedObjects),
		getItems: (ctx: MenuContext): ContextMenuList => {
			const objects = (ctx.data?.selectedObjects ?? []) as ISmartObject[];
			return buildSmartObjectsMenu(objects, ctx);
		}
	};
}
