<script lang="ts">
	import { useTheme } from '@/theme';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { Button as ButtonPrimitive } from 'bits-ui';

	const { currentThemeHEX } = useTheme();

	let {
		builders = [],
		checked = $bindable(false),
		disabled = false,
		onToggle = () => {},
		...props
	} = $props();

	function handleClick() {
		if (disabled) return;
		checked = !checked;
		onToggle(checked);
	}
</script>

<ButtonPrimitive.Root
	{builders}
	type="button"
	role="switch"
	aria-checked={checked}
	aria-disabled={disabled}
	class="
	relative
	inline-flex h-7 w-11 shrink-0 rounded-lg outline-none
    transition-colors duration-200 ease-in-out
    {checked ? 'bg-primary' : ' bg-secondary'}
    {disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
    {!disabled && (checked ? 'hover:bg-primary hover:opacity-90' : 'hover:bg-border')}
  "
	onclick={handleClick}
	tabindex={disabled ? -1 : 0}
	{...props}
>
	<span
		class="
		absolute
      top-0.5 m-0 flex h-6 w-6 items-center justify-center rounded-md bg-background
		p-0 shadow
      transition-transform duration-200 ease-in-out
      {checked ? 'translate-x-[18px]' : 'translate-x-0.5'}
    "
	>
		<ThemeIcon color={checked ? $currentThemeHEX['--primary'] : undefined} name="focus-mode" />
	</span>
</ButtonPrimitive.Root>
