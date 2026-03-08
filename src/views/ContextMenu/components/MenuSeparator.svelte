<script lang="ts">
	import type { MenuItem } from '@editor/context-menu';

	export let item: MenuItem;
	export let tLabel: (item: MenuItem) => string;
	export let onSelect: (item: MenuItem) => void;
</script>

<div class="my-1 h-px bg-border" />
