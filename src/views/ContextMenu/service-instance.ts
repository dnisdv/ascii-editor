import {
	ContextMenuService,
	createGlobalContextMenuProvider,
	createSelectionProvider,
	createSmartObjectsProvider
} from '@editor/context-menu';

export const contextMenuService = new ContextMenuService();

let providersRegistered = false;
export function registerDefaultContextMenuProviders(): void {
	if (providersRegistered) return;
	contextMenuService.registerProvider(createGlobalContextMenuProvider());
	contextMenuService.registerProvider(createSelectionProvider());
	contextMenuService.registerProvider(createSmartObjectsProvider());
	providersRegistered = true;
}
