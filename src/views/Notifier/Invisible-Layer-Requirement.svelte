<script lang="ts">
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button } from '@components/button';
	import { Separator } from '@components/separator';

	export let actions: { label: string; onClick: () => void }[] = [];
	export let action: { label: string; onClick: () => void } | undefined = undefined;
	export let description: string = 'Layer is hidden';
	export let close = () => {};

	$: allActions = action ? [action, ...actions] : actions;
</script>

<div
	class="flex h-10 items-center rounded-xl border border-solid border-border bg-background shadow-lg"
>
	<ThemeIcon class="pl-2" name="eye-closed" />
	<Separator class="mx-2" orientation="vertical" />
	<p class="text-sm font-medium">{description}</p>
	{#each allActions as act, i (i)}
		<Button class="ml-2 text-xs" on:click={act.onClick} variant="outline" size="xxs"
			>{act.label}</Button
		>
	{/each}

	<Separator class="mx-2" orientation="vertical" />
	<Button class="mr-2" on:click={close} variant="ghost" size="icon-xxs">
		<ThemeIcon size={16} name="x" />
	</Button>
</div>
