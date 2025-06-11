<script lang="ts">
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import * as Tooltip from '@components/tooltip';
	import { useCore } from '@/config/useCore';
	import type { CameraControlTool } from '@editor/tools/camera-control';

	const core = useCore();

	const fitWidth = () => {
		const cameraTool = core.getToolManager().getTool('camera-control') as CameraControlTool;
		cameraTool.fitToContent();
	};
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<Button builders={[builder]} on:click={fitWidth} size="icon-sm" variant="ghost">
			<IconLoader name="fitwidth" />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content>Fit width</Tooltip.Content>
</Tooltip.Root>

<style>
</style>
