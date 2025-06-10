<script lang="ts">
	import { useCore } from '@/config/useCore';
	import type { ExportTool } from '@editor/tools/export/export-tool';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { portal } from '@/lib/portal';
	import Button from '@components/button/button.svelte';
	import * as DropdownMenu from '@components/dropdown-menu';

	const core = useCore();
	const toolExport = core.getToolManager().getTool('export') as ExportTool;
	const camera = core.getCamera();
	const isExportToolActive = writable(false);

	import { containerQuery } from '@lib/container-media-query';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	const breakpoints = {
		centeredIcons: 50,
		iconOnly: 140,
		closeIconOnly: 160,
		hideShortcut: 280
	};

	const cq = writable({
		iconOnly: false,
		centeredIcons: false,
		closeIconOnly: false,
		hideShortcut: false
	});

	const uiState = writable({
		visible: false,
		x: 0,
		y: 0,
		width: 0
	});

	function updateUiPosition() {
		if (!toolExport || !camera) return;

		const session = toolExport.selectionSessionManager.getActiveSession();
		const region = session?.getSelectedRegion();

		if (region) {
			const worldX = region.startX;
			const worldY = region.startY;

			const cssPos = camera.worldToCssPixels(worldX, worldY);
			const endPos = camera.worldToCssPixels(worldX + region.width, worldY);

			const selectionWidthInCss = endPos.x - cssPos.x;

			uiState.set({
				visible: true,
				x: cssPos.x,
				y: cssPos.y,
				width: selectionWidthInCss
			});
		} else {
			uiState.set({ visible: false, x: 0, y: 0, width: 0 });
		}
	}

	onMount(() => {
		if (!toolExport) return;

		const toolManager = core.getToolManager();
		isExportToolActive.set(toolManager.getActiveToolName() === 'export');
		toolManager.on('tool::activate', ({ name }) => {
			isExportToolActive.set(name === 'export');
		});

		updateUiPosition();
		toolExport.selectionSessionManager.on('session::region_updated', updateUiPosition);
		toolExport.selectionSessionManager.on('manager::session_destroyed', () => {
			uiState.set({ visible: false, x: 0, y: 0, width: 0 });
		});

		camera.on('change', updateUiPosition);
	});

	function handleCopy() {
		toolExport.handleExportCopy();
	}

	function handleClose() {
		toolExport.handleClose();
	}
</script>

{#if $uiState.visible}
	<div
		use:portal
		use:containerQuery={{ breakpoints, store: cq }}
		class="button-container pointer-events-none gap-1.5"
		style:width="{$uiState.width}px"
		style:justify-content={!$cq.centeredIcons ? 'space-between' : 'center'}
		style:top="{$uiState.y}px"
		style:left="{$uiState.x}px"
	>
		<Button variant="secondary" class="pointer-events-auto hover:bg-secondary" size="icon-xxs"
			><ThemeIcon name="copy-area" /></Button
		>
		<div class="button-group">
			{#if $cq.iconOnly}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="max-h-6 max-w-6">
						<Button variant="secondary" size="icon-xxs"
							><ThemeIcon name="3dots-horizontal" /></Button
						>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-48" align="start">
						<DropdownMenu.Item on:click={handleCopy}>
							Copy Area
							<DropdownMenu.Shortcut>Ctrl+Shift+C</DropdownMenu.Shortcut>
						</DropdownMenu.Item>
						<DropdownMenu.Item on:click={handleClose}>
							Close
							<DropdownMenu.Shortcut>Esc</DropdownMenu.Shortcut>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<Button
					on:click={handleCopy}
					variant="default"
					class="z-10 flex gap-1.5 bg-primary-export text-xs hover:bg-primary-export/90"
					size="xxs"
				>
					Copy Area
					{#if !$cq.hideShortcut}
						<span class="opacity-50">Ctrl+Shift+C</span>
					{/if}
				</Button>

				{#if $cq.closeIconOnly}
					<Button variant="secondary" size="icon-xxs"><ThemeIcon size={16} name="x" /></Button>
				{:else}
					<Button on:click={handleClose} variant="secondary" class="flex gap-1.5 text-xs" size="xxs"
						>Close

						{#if !$cq.hideShortcut && $isExportToolActive}
							<span class="opacity-50">Esc</span>
						{/if}
					</Button>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	.button-container,
	.button-container :global(*) {
		cursor:
			url(/icons/cursor-default.png) 5 3,
			default !important;
	}

	.button-container {
		@apply absolute z-10 flex justify-between;
		transform: translateY(calc(-100% - 4px));
		container-type: inline-size;
		container-name: export-ui-container;
	}

	.button-group {
		@apply pointer-events-auto flex gap-1;
	}
</style>
