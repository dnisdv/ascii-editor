<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from '../Tool-Tooltip.svelte';
	import ToolExportCanvasUi from './Tool-Export-Canvas-Ui.svelte';
	import { writable } from 'svelte/store';
	import { useCore } from '@/config/useCore';

	let name = 'export';
	const { currentThemeHEX } = useTheme();
	const core = useCore();
	const tools = core.getToolManager();

	const isActive = writable(tools.getActiveToolName() === name);
	tools.on('tool::activated', (tool) => {
		isActive.set(tool.name === name);
	});

	function activate(toolName: string) {
		tools.activateTool(toolName);
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<Button
			class={`tool cursor-default ${$isActive ? ' bg-primary-export hover:bg-primary-export hover:text-inherit' : ''}`}
			type="button"
			variant={$isActive ? 'default' : 'ghost'}
			size="icon-sm"
			on:click={() => activate(name)}
			on:keydown={(e) => e.key === 'Enter' && activate(name)}
			aria-label={`Activate ${name} tool`}
			builders={[builder]}
		>
			<ThemeIcon
				name="copy-area"
				size={16}
				color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
			/>
		</Button>
	</Tooltip.Trigger>
	<ToolTooltip name="Export" hotkey="Alt+E" />
</Tooltip.Root>

<ToolExportCanvasUi />

<style>
</style>
