<script lang="ts">
	import Button from '@components/button/button.svelte';
	import ToolDraw from './Draw/Tool-Draw.svelte';
	import ToolSelect from './Tool-Select.svelte';
	import ToolShapes from './Tool-Shapes.svelte';
	import ToolText from './Tool-Text.svelte';
</script>

<div class="tools" role="toolbar" aria-label="Toolools">
	<ToolSelect />
	<ToolDraw />
	<ToolShapes />
	<ToolText />
</div>

<style>
	.tools {
		@apply fixed left-1/2 top-2.5 z-50 flex h-auto -translate-x-1/2 cursor-default gap-2 rounded-xl border border-solid border-border bg-background p-1;
	}
</style>
