<script lang="ts">
	import FitWidth from './FitWidth.svelte';
	import Theme from './Theme.svelte';
	import ZoomControl from './ZoomControl.svelte';
</script>

<div class="fixed right-4 top-2.5 z-50 flex h-auto items-center gap-2">
	<div
		class="flex rounded-xl border border-solid border-border bg-background p-1"
		aria-label="Actions Bar"
	>
		<Theme />
		<FitWidth />
		<ZoomControl />
	</div>
</div>
