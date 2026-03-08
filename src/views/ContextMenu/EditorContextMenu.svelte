<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type {
		ContextMenuList,
		MenuContext,
		MenuItem,
		ToggleMenuItem
	} from '@editor/context-menu';
	import { MenuId, LabelKey } from '@editor/context-menu';
	import {
		contextMenuService,
		registerDefaultContextMenuProviders
	} from '@views/ContextMenu/service-instance';
	import { useCore } from '@/config/useCore';
	import { useStore } from '@store/useStore';
	import { useTheme } from '@/theme/useTheme';
	import { t } from '$lib/i18n';

	import MenuSeparator from './components/MenuSeparator.svelte';
	import MenuButton from './components/MenuButton.svelte';
	import MenuSubmenu from './components/MenuSubmenu.svelte';

	const core = useCore();
	const store = useStore();
	const { theme } = useTheme();
	const commands = core.getCommands();

	let open = false;
	let x = 0;
	let y = 0;
	let items: ContextMenuList = [];

	function hideMenu(): void {
		open = false;
		items = [];
	}

	function tLabel(item: MenuItem): string {
		if ('labelKey' in item && item.labelKey) return t(item.labelKey);
		return item.label ?? '';
	}

	function updateItemsState(list: ContextMenuList) {
		let currentThemeVal: string;
		const unsubscribe = theme.subscribe((v) => (currentThemeVal = v));
		unsubscribe();

		const state = store.getState().ui;

		const update = (list: ContextMenuList) => {
			list.forEach((item) => {
				if (item.kind === 'radio' && item.groupId === 'theme') {
					item.selected = item.value === currentThemeVal;
				}
				if (item.id === MenuId.ViewToggleUI) {
					item.labelKey = state.visible ? LabelKey.ViewHideUI : LabelKey.ViewShowUI;
				}
				if (item.id === MenuId.ViewToggleGrid) {
					item.labelKey = state.gridVisible ? LabelKey.ViewHideGrid : LabelKey.ViewShowGrid;
				}
				if (item.kind === 'submenu' && item.items) {
					update(item.items);
				}
			});
		};
		update(list);
	}

	function handleCommand(item: MenuItem): boolean {
		if (!('commandId' in item) || !item.commandId) return false;

		const originalArgs = item.args;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const args: Record<string, any> =
			typeof originalArgs === 'object' && originalArgs !== null
				? { ...originalArgs }
				: { value: originalArgs };
		args.contextMenuPosition = { x, y };

		commands.execute(item.commandId, args);
		return true;
	}

	function handleOnSelect(item: MenuItem): boolean {
		if ('onSelect' in item && typeof item.onSelect === 'function') {
			item.onSelect();
			return true;
		}
		return false;
	}

	function handleToggle(item: MenuItem): boolean {
		if (item.kind !== 'toggle') return false;
		const toggleItem = item as ToggleMenuItem;
		const fn = toggleItem.onToggle;
		if (typeof fn !== 'function') return false;
		const next = toggleItem.checked === true ? false : true;
		fn(next);
		return true;
	}

	function onItemSelect(item: MenuItem): void {
		hideMenu();
		if (handleCommand(item)) return;
		if (handleOnSelect(item)) return;
		handleToggle(item);
	}

	type Cmp = typeof MenuSeparator | typeof MenuButton | typeof MenuSubmenu;
	function componentFor(item: MenuItem): Cmp {
		const map: Record<MenuItem['kind'], Cmp> = {
			separator: MenuSeparator,
			submenu: MenuSubmenu,
			toggle: MenuButton,
			command: MenuButton,
			radio: MenuButton
		} as const;
		return map[item.kind];
	}

	function isVisible(item: MenuItem): boolean {
		return item.visible ?? true;
	}

	function attachListeners() {
		const clickToHide = () => hideMenu();
		const escapeToHide = (e: KeyboardEvent) => {
			if (e.key === 'Escape') hideMenu();
		};
		window.addEventListener('click', clickToHide);
		window.addEventListener('keydown', escapeToHide);

		return () => {
			window.removeEventListener('click', clickToHide);
			window.removeEventListener('keydown', escapeToHide);
		};
	}

	onMount(() => {
		registerDefaultContextMenuProviders();
		const onShow = ({
			x: sx,
			y: sy,
			items: its
		}: {
			x: number;
			y: number;
			items: ContextMenuList;
			context: MenuContext;
		}) => {
			updateItemsState(its);
			x = sx;
			y = sy;
			items = its;
			open = items.length > 0;
		};
		const onHide = () => hideMenu();
		contextMenuService.on('menu:show', onShow);
		contextMenuService.on('menu:hide', onHide);
		const detach = attachListeners();
		return () => {
			detach();
			contextMenuService.off('menu:show', onShow);
			contextMenuService.off('menu:hide', onHide);
		};
	});

	onDestroy(() => hideMenu());
</script>

{#if open}
	<div class="fixed z-50" style="left: {x}px; top: {y}px;">
		<div class="min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
			{#each items.filter(isVisible) as item, i (item.id ?? item.labelKey ?? item.label ?? i)}
				<svelte:component this={componentFor(item)} {item} {tLabel} onSelect={onItemSelect} />
			{/each}
		</div>
	</div>
{/if}
