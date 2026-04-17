<script lang="ts">
	import { Button } from '@components/button';
	import { writable } from 'svelte/store';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { useTheme } from '@/theme';
	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from './Tool-Tooltip.svelte';
	import { useCore } from '@/config/useCore';

	const { currentThemeHEX } = useTheme();
	const core = useCore();

	let name = 'eraser';

	const tools = core.getToolManager();
	const isActive = writable(tools.getActiveToolName() === name);

	tools.on('tool::activated', (tool) => {
		isActive.set(tool.name === name);
	});

	function activate(toolName: string) {
		core.getToolManager().activateTool(toolName);
	}
</script>

<Tooltip.Root closeDelay={0}>
	<Tooltip.Trigger asChild let:builder>
		<Button
			class={`tool relative cursor-default ${$isActive ? ' hover:bg-primary hover:text-inherit' : ''}`}
			variant={$isActive ? 'default' : 'ghost'}
			size="icon-sm"
			on:click={() => activate(name)}
			on:keydown={(e) => e.key === 'Enter' && activate(name)}
			aria-label={`Activate ${name} tool`}
			builders={[builder]}
		>
			<ThemeIcon
				name="eraser"
				color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
				size={16}
			/>
		</Button>
	</Tooltip.Trigger>
	<ToolTooltip name="Eraser" hotkey="Alt+X" hint="Alt+Right Drag to resize" />
</Tooltip.Root>
