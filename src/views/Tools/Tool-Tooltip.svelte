<script lang="ts">
	import * as Tooltip from '@components/tooltip';

	export let name: string;
	export let hotkey: string;
</script>

<Tooltip.Content class="flex gap-2">
	<p class="text-xs font-medium">{name}</p>
	<p class="text-xs font-medium opacity-50">{hotkey}</p>
</Tooltip.Content>
