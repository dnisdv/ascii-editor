<script lang="ts">
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import { Separator } from '@components/separator';

	export let action: { label: string; onClick: () => void };
	export let close = () => {};
</script>

<div
	class="flex h-10 items-center rounded-xl border border-solid border-border bg-background shadow-lg"
>
	<ThemeIcon class="pl-2" name="eye-closed" />
	<Separator class="mx-2" orientation="vertical" />
	<p class="text-sm font-medium">Layer is hidden</p>
	<Button class="ml-2  text-xs" on:click={action.onClick} variant="outline" size="xxs">Show</Button>

	<Separator class="mx-2" orientation="vertical" />
	<Button class="mr-2" on:click={close} variant="ghost" size="icon-xxs">
		<ThemeIcon size={16} name="x" />
	</Button>
</div>
