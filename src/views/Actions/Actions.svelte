<script lang="ts">
	import Separator from '@components/separator/separator.svelte';
	import FitWidth from './FitWidth.svelte';
	import Theme from './Theme.svelte';
	import ZoomControl from './ZoomControl.svelte';
	import FocusMode from './FocusMode.svelte';
</script>

<div class="fixed right-4 top-2.5 z-50 flex h-auto items-center gap-2">
	<div
		class="outline-solid flex min-h-10 items-center rounded-xl bg-background p-1 pl-2 outline outline-1 outline-border"
		aria-label="Actions Bar"
	>
		<FocusMode />
		<Separator orientation="vertical" class="mx-3 h-4 max-h-4 min-h-0" />
		<Theme />
		<FitWidth />
		<ZoomControl />
	</div>
</div>
