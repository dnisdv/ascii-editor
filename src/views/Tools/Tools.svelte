<script lang="ts">
	import ToolDraw from './Draw/Tool-Draw.svelte';
	import ToolExport from './Export/Tool-Export.svelte';
	import ToolSelect from './Tool-Select.svelte';
	import ToolShapes from './Tool-Shapes.svelte';
	import ToolText from './Tool-Text.svelte';
</script>

<div
	class="
	outline-solid fixed left-1/2 top-2.5 z-50 flex h-auto -translate-x-1/2 cursor-default
	gap-2 rounded-xl bg-background p-1 outline outline-1 outline-border"
	role="toolbar"
	aria-label="Toolools"
>
	<ToolSelect />
	<ToolDraw />
	<ToolShapes />
	<ToolText />
	<ToolExport />
</div>
