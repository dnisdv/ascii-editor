<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '@lib/utils.js';

	type $$Props = SelectPrimitive.ItemProps;

	let className: $$Props['class'] = undefined;
	export let value: $$Props['value'];
	export let label: $$Props['label'] = undefined;
	export let disabled: $$Props['disabled'] = undefined;
	export { className as class };
</script>

<SelectPrimitive.Item
	{value}
	{label}
	{disabled}
	class={cn(
		'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className
	)}
	{...$$restProps}
	on:click
	on:pointermove
	on:focusin
	on:keydown
	on:focusout
	on:pointerleave
>
	<slot />
</SelectPrimitive.Item>
