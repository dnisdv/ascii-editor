<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from './Tool-Tooltip.svelte';
	import { writable } from 'svelte/store';
	import { useCore } from '@/config/useCore';

	let name = 'select';
	const core = useCore();
	const tools = core.getToolManager();

	const isActive = writable(tools.getActiveToolName() === name);
	const { currentThemeHEX } = useTheme();

	tools.on('tool::activated', (tool) => {
		isActive.set(tool.name === name);
	});

	function activate(toolName: string) {
		core.getToolManager().activateTool(toolName);
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<Button
			class={`tool cursor-default ${$isActive ? ' hover:bg-primary hover:text-inherit' : ''}`}
			type="button"
			variant={$isActive ? 'default' : 'ghost'}
			size="icon-sm"
			on:click={() => activate(name)}
			on:keydown={(e) => e.key === 'Enter' && activate(name)}
			aria-label={`Activate ${name} tool`}
			builders={[builder]}
		>
			<ThemeIcon
				name="mouse"
				size={16}
				color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
			/>
		</Button>
	</Tooltip.Trigger>
	<ToolTooltip name="Move" hotkey="Alt+V" />
</Tooltip.Root>

<style>
</style>
