<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { type Size, type Variant, toggleVariants } from './index.js';
	import { cn } from '@lib/utils.js';

	type $$Props = TogglePrimitive.Props & {
		variant?: Variant;
		size?: Size;
		class?: string | null | undefined;
	};

	let className: $$Props['class'] = undefined;
	export let variant: $$Props['variant'] = 'default';
	export let size: $$Props['size'] = 'default';
	export let pressed: $$Props['pressed'] = undefined;
	export { className as class };
</script>

<TogglePrimitive.Root
	bind:pressed
	class={cn(toggleVariants({ variant, size, className }))}
	{...$$restProps}
	on:click
>
	<slot />
</TogglePrimitive.Root>
