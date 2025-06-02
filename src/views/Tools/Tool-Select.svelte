<script lang="ts">
	import { useToolBus } from '@/bus/useToolsBus';
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import * as Tooltip from '@components/tooltip';
	import { isToolActive } from '@store/slices/tools';
	import { useSelector } from '@store/useSelector';
	import ToolTooltip from './Tool-Tooltip.svelte';

	let name = 'select';
	const { currentThemeHEX } = useTheme();

	const toolBus = useToolBus();
	const isActive = useSelector(isToolActive(name));

	function activate(toolName: string) {
		toolBus.emit('tool::activate::request', { name: toolName });
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
