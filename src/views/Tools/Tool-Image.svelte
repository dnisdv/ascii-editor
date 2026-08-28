<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';

	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from './Tool-Tooltip.svelte';
	import { writable } from 'svelte/store';
	import { useCore } from '@/config/useCore';
	import type { ImageToolApi } from '@editor/tools/image/image-tool';
	const { currentThemeHEX } = useTheme();
	let name = 'image';

	const core = useCore();
	const tools = core.getToolManager();

	const isActive = writable(tools.getActiveToolName() === name);

	tools.on('tool::activated', (tool) => {
		isActive.set(tool.name === name);
	});

	function activate(toolName: string) {
		if (tools.isActive(toolName)) {
			tools.getToolApi<ImageToolApi>(toolName)?.pickImage();
			return;
		}
		tools.activateTool(toolName);
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
				size={16}
				name="image"
				color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
			/>
		</Button>
	</Tooltip.Trigger>
	<ToolTooltip name="Image" hotkey="Alt+I" />
</Tooltip.Root>

<style>
</style>
