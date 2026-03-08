<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';

	import * as Tooltip from '@components/tooltip';
	import ToolTooltip from './Tool-Tooltip.svelte';
	import { writable } from 'svelte/store';
	import { useCore } from '@/config/useCore';
	import { Shapes } from '@editor/tools/shape/shape-draw-tool';

	import * as DropdownMenu from '@components/dropdown-menu';

	const { currentThemeHEX } = useTheme();
	const core = useCore();
	const tools = core.getToolManager();

	let name = 'shape';
	const isActive = writable(tools.getActiveToolName() === name);

	let shapeTool = tools.getTool(name) as unknown as {
		currentShape: Shapes;
		setShape: (shape: Shapes) => void;
	};
	const shapeOptions: Array<{ value: Shapes; label: string; icon: string }> = [
		{ value: Shapes.rectangle, label: 'Rectangle', icon: 'rectangle' },
		{ value: Shapes.line, label: 'Line', icon: 'line' }
	];
	const currentShape = writable<Shapes>(shapeTool?.currentShape ?? Shapes.rectangle);

	function setShape(shape: Shapes) {
		shapeTool.setShape(shape);
		currentShape.set(shape);

		if (!tools.isActive(name)) {
			tools.activateTool(name);
			shapeTool = tools.getTool(name) as unknown as {
				currentShape: Shapes;
				setShape: (shape: Shapes) => void;
			};
		}
	}

	tools.on('tool::activated', (tool) => {
		isActive.set(tool.name === name);
		if (tool.name === name) {
			shapeTool = tools.getTool(name) as unknown as {
				currentShape: Shapes;
				setShape: (shape: Shapes) => void;
			};
		}
	});

	function activate(toolName: string) {
		tools.activateTool(toolName);
	}
</script>

<div class="flex items-center gap-1">
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
					name={shapeOptions.find((o) => o.value === $currentShape)?.icon || 'rectangle'}
					color={$isActive ? $currentThemeHEX['--primary-foreground'] : undefined}
				/>
			</Button>
		</Tooltip.Trigger>
		<ToolTooltip name="Shape Tool" hotkey="Alt+S" />
	</Tooltip.Root>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger asChild let:builder>
			<Button
				class="h-full w-auto cursor-default"
				size="icon-xxs"
				variant="ghost"
				builders={[builder]}
			>
				<ThemeIcon name="arrow-down" />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content
			align="center"
			sideOffset={4}
			class="rounded-md border border-border bg-background p-1"
		>
			{#each shapeOptions as opt (opt.value)}
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-primary/10"
					on:click={() => setShape(opt.value)}
				>
					<div class="flex w-4 items-center justify-center">
						{#if opt.value === $currentShape}
							<ThemeIcon name="check" size={14} />
						{/if}
					</div>
					<ThemeIcon name={opt.icon} size={16} />
					<span class="flex-1">{opt.label}</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<style></style>
