<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from './Tool-Tooltip.svelte';
	import { writable } from 'svelte/store';
	import { useCore } from '@/config/useCore';

	const { currentThemeHEX } = useTheme();
	const core = useCore();
	const tools = core.getToolManager();

	let name = 'line';
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
			type="button"
			variant={$isActive ? 'default' : 'ghost'}
			size="icon-sm"
			class={`tool cursor-default ${$isActive ? ' hover:bg-primary hover:text-inherit' : ''}`}
			on:click={() => activate(name)}
			on:keydown={(e) => e.key === 'Enter' && activate(name)}
			aria-label={`Activate ${name} tool`}
			builders={[builder]}
		>
			<ThemeIcon
				size={16}
				name="line"
				color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
			/>
		</Button>
	</Tooltip.Trigger>
	<ToolTooltip name="Line" hotkey="Alt+L" />
</Tooltip.Root>

<style>
</style>
