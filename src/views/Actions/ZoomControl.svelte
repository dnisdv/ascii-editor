<script lang="ts">
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import { writable } from 'svelte/store';
	import * as Tooltip from '@components/tooltip';
	import { useCore } from '@/config/useCore';
	import type { CameraControlTool } from '@editor/tools/camera-control';
	import { onMount } from 'svelte';

	const core = useCore();

	const zoomPercentage = writable(100);

	const increaseZoom = () => {
		const cameraTool = core.getToolManager().getTool('camera-control') as CameraControlTool;
		cameraTool.zoomIn();
	};

	const decreaseZoom = () => {
		const cameraTool = core.getToolManager().getTool('camera-control') as CameraControlTool;
		cameraTool.zoomOut();
	};

	const resetZoom = () => {
		const cameraTool = core.getToolManager().getTool('camera-control') as CameraControlTool;
		cameraTool.zoomToPercentage(100);
	};

	onMount(() => {
		const camera = core.getCamera();

		zoomPercentage.set(Math.round(camera.getZoomPercentage()));
		camera.on('change', () => {
			zoomPercentage.set(Math.round(camera.getZoomPercentage()));
		});
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
