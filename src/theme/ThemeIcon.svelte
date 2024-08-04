<script lang="ts">
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import { useTheme } from './useTheme';

	const { currentThemeHEX } = useTheme();

	type $$Props = {
		name: string;
		size?: number;
		color?: string;
		class?: string;
	};

	let className: $$Props['class'] = undefined;
	export { className as class };

	export let name: string;
	export let size: number = 16;
	export let color: string | undefined = undefined;

	$: themeAwareColor = color || $currentThemeHEX['--foreground'];
</script>

<IconLoader class={className} {name} {size} color={themeAwareColor} />
