<script lang="ts">
	import { useToolBus } from '@/bus';
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import { writable } from 'svelte/store';
	import * as Tooltip from '@components/tooltip';

	const toolBus = useToolBus();
	const zoomPercentage = writable(100);

	const increaseZoom = () => {
		toolBus.withTool('camera-control').emit('zoom-increment::request');
	};

	const decreaseZoom = () => {
		toolBus.withTool('camera-control').emit('zoom-decrement::request');
	};

	const resetZoom = () => {
		toolBus.withTool('camera-control').emit('zoom-change::request', {
			percentage: 100
		});
	};

	toolBus.withTool('camera-control').on('zoom-change::response', (data) => {
		const zoom = (data as { zoom: number }).zoom;
		zoomPercentage.set(Math.round(zoom));
	});
</script>

<div class="flex">
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button builders={[builder]} on:click={decreaseZoom} size="icon-sm" variant="ghost">
				<IconLoader name="minus" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>Zoom out</Tooltip.Content>
	</Tooltip.Root>

	<Button class="w-14 min-w-14 max-w-14" on:click={resetZoom} size="sm" variant="ghost"
		>{$zoomPercentage}%</Button
	>

	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button builders={[builder]} on:click={increaseZoom} size="icon-sm" variant="ghost">
				<IconLoader name="plus" />
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>Zoom in</Tooltip.Content>
	</Tooltip.Root>
</div>
