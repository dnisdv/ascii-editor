<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import { Scrollbar } from './index.js';
	import { cn } from '@lib/utils.js';
	import { onMount } from 'svelte';
	import { nanoid } from '@reduxjs/toolkit';
	import { type Writable } from 'svelte/store';

	type Props = ScrollAreaPrimitive.Props & {
		orientation?: 'vertical' | 'horizontal' | 'both';
		scrollbarXClasses?: string;
		scrollbarYClasses?: string;
		onScroll?: (event: Event) => void;
		viewPort?: Writable<Element | null>;
	};

	let className: Props['class'] = undefined;
	export { className as class };
	export let orientation = 'vertical';
	export let scrollbarXClasses: string = '';
	export let scrollbarYClasses: string = '';
	export let onScroll: Props['onScroll'];

	export let viewPortId: string = 'scroll-area-viewport' + nanoid();

	export let viewPort: Props['viewPort'] | undefined = undefined;
	onMount(() => {
		const element = document.querySelector(`#${viewPortId}`);
		if (!element || !viewPort) return;

		viewPort.set(element);
		if (element && onScroll) {
			element.addEventListener('scroll', onScroll);
		}
	});
</script>

<ScrollAreaPrimitive.Root {...$$restProps} class={cn('relative overflow-hidden', className)}>
	<ScrollAreaPrimitive.Viewport id={viewPortId} class="h-full w-full rounded-[inherit]">
		<ScrollAreaPrimitive.Content>
			<slot />
		</ScrollAreaPrimitive.Content>
	</ScrollAreaPrimitive.Viewport>
	{#if orientation === 'vertical' || orientation === 'both'}
		<Scrollbar orientation="vertical" class={scrollbarYClasses} />
	{/if}
	{#if orientation === 'horizontal' || orientation === 'both'}
		<Scrollbar orientation="horizontal" class={scrollbarXClasses} />
	{/if}
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
