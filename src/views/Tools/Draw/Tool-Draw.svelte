<script lang="ts">
	import { Button } from '@components/button';
	import ToolSymbols from './Tool-Symbols.svelte';
	import { useSelector } from '@store/useSelector';
	import type { RootState } from '@store/store';
	import { writable } from 'svelte/store';
	import { useToolBus } from '@/bus/useToolsBus';
	import { isToolActive } from '@store/slices/tools';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { useTheme } from '@/theme';
	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from '../Tool-Tooltip.svelte';

	const toolBus = useToolBus();
	const { theme, currentThemeHEX } = useTheme();

	let name = 'draw';
	const isActive = useSelector(isToolActive(name));

	type DrawOpts = {
		activeSymbol: string;
	};

	const activeSymbol = writable<string | null>(null);
	const drawTool = useSelector((store: RootState) => store.tools.data.draw);

	drawTool.subscribe((i) => {
		if (!i) return;
		activeSymbol.set((i.config as DrawOpts).activeSymbol);
		selectedSymbol.set((i.config as DrawOpts).activeSymbol);
	});

	function activate(toolName: string) {
		toolBus.emit('tool::activate::request', { name: toolName });
	}

	const onSymbolSelect = (symbol: string) => {
		selectedSymbol.set(symbol);
		toolBus.emit('tool::update_config::request', {
			name: 'draw',
			config: { activeSymbol: symbol }
		});

		toolBus.emit('tool::activate::request', { name });
	};

	let selectedSymbol = writable('');
</script>

<div class=" wrapper flex cursor-default items-center justify-center">
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
					name="symbolBrush"
					color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
					size={16}
				/>

				<span
					class="symbol"
					class:light={$theme === 'light'}
					class:dark={$theme === 'dark'}
					class:active={$isActive}>{$selectedSymbol}</span
				>
			</Button>
		</Tooltip.Trigger>
		<ToolTooltip name="Brush" hotkey="Alt+D" />
	</Tooltip.Root>

	<ToolSymbols bind:selectedSymbol onSymbolChange={onSymbolSelect}>
		<Tooltip.Root closeDelay={0}>
			<Tooltip.Trigger asChild let:builder>
				<Button
					class="h-full w-auto cursor-default"
					size="icon-xxs"
					variant="ghost"
					aria-label={`Activate ${name} tool`}
					builders={[builder]}
				>
					<ThemeIcon name="arrow-down" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>Brush symbols</Tooltip.Content>
		</Tooltip.Root>
	</ToolSymbols>
</div>

<style lang="postcss">
	.symbol {
		@apply absolute bottom-[8px] text-[10px] leading-none;
		font-family: 'Liberation Mono', serif;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;

		left: 72%;
		transform: translateX(-50%);
	}

	.symbol.dark {
		@apply text-primary-foreground;
	}
	.symbol.light {
		@apply text-foreground;

		&.active {
			@apply text-primary-foreground;
		}
	}
</style>
