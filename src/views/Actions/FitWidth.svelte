<script lang="ts">
	import { useToolBus } from '@/bus';
	import { Button } from '@components/button';
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import * as Tooltip from '@components/tooltip';

	const toolBus = useToolBus();

	const fitWidth = () => {
		toolBus.withTool('camera-control').emit('fit-width::request', {});
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
