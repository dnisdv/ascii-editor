import { EventEmitter } from '@editor/event-emitter';
import type { ContextMenuList, MenuContext } from './context-menu.interface';
import { ContextMenuBuilder } from './context-menu.builder';

export type ContextMenuEvents = {
	'menu:show': { x: number; y: number; items: ContextMenuList; context: MenuContext };
	'menu:hide': undefined;
};

export interface ContextMenuProvider {
	id: string;
	when: (ctx: MenuContext) => boolean;
	getItems: (ctx: MenuContext) => ContextMenuList;
}

export class ContextMenuService extends EventEmitter<ContextMenuEvents> {
	private providers: ContextMenuProvider[] = [];

	registerProvider(provider: ContextMenuProvider): void {
		this.providers.push(provider);
		this.providers.sort((a, b) => a.id.localeCompare(b.id));
	}

	unregisterProvider(id: string): void {
		this.providers = this.providers.filter((p) => p.id !== id);
	}

	build(ctx: MenuContext): ContextMenuList {
		const lists = this.providers.filter((p) => p.when(ctx)).map((p) => p.getItems(ctx));
		return ContextMenuBuilder.merge(lists);
	}

	showAt(x: number, y: number, ctx: MenuContext): void {
		const items = this.build(ctx);
		this.emit('menu:show', { x, y, items, context: ctx });
	}

	hide(): void {
		this.emit('menu:hide', undefined);
	}
}
