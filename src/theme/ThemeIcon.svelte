<script lang="ts">
	import IconLoader from '@lib/svelteIcons/IconLoader.svelte';
	import { useTheme } from './useTheme';

	const { currentThemeHEX } = useTheme();

	let className: string | undefined = undefined;
	export { className as class };

	export let name: string;
	export let size: number | undefined = undefined;
	export let color: string | undefined = undefined;

	$: themeAwareColor = color || $currentThemeHEX['--foreground'];
</script>

<IconLoader class={className} {name} {size} color={themeAwareColor} />
