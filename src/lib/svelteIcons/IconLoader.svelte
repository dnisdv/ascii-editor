<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { writable } from 'svelte/store';

	type IconComponentDefinition = typeof SvelteComponent<{ size?: number; color?: string }>;

	type IconLoader = () => Promise<{
		default: IconComponentDefinition;
	}>;

	const iconMap: { [x in string]: IconLoader } = {
		draw: () => import('./DrawIcon.svelte'),
		mouse: () => import('./MouseIcon.svelte'),
		layer: () => import('./Layer.svelte'),
		'3dots-horizontal': () => import('./ThreeDots-horizontal.svelte'),
		'arrow-down': () => import('./ArrownDown.svelte'),
		pen: () => import('./Pen.svelte'),
		trash: () => import('./Trash.svelte'),
		duplicate: () => import('./Duplicate.svelte'),
		download: () => import('./Download.svelte'),
		plus: () => import('./Plus.svelte'),
		minus: () => import('./Minus.svelte'),
		hide: () => import('./Hide.svelte'),
		fitwidth: () => import('./FitWidth.svelte'),
		eye: () => import('./Eye.svelte'),
		expand: () => import('./Expand.svelte'),
		moon: () => import('./Moon.svelte'),
		sun: () => import('./Sun.svelte'),
		rectangle: () => import('./Rectangle.svelte'),
		'eye-closed': () => import('./EyeClosed.svelte'),
		show: () => import('./Show.svelte'),
		copy: () => import('./Copy.svelte'),
		typo: () => import('./Typo.svelte'),
		logo: () => import('./Logo.svelte'),
		file: () => import('./File.svelte'),
		symbolBrush: () => import('./SymbolBrush.svelte'),
		x: () => import('./X.svelte'),
		'file-type': () => import('./FileType.svelte'),
		'focus-mode': () => import('./FocusMode.svelte'),
		'copy-area': () => import('./CopyArea.svelte'),
		'alert-triangle': () => import('./AlertTriangle.svelte'),
		info: () => import('./Info.svelte'),
		check: () => import('./Check.svelte'),
		github: () => import('./Github.svelte')
	} as const;

	type IconName = keyof typeof iconMap;

	type $$Props = {
		name: IconName;
		size?: number;
		color?: string;
		class?: string;
	};

	let className: $$Props['class'] = undefined;
	export { className as class };

	export let name: IconName;
	export let size: number | undefined = undefined;
	export let color = 'currentColor';

	const iconComponent = writable<IconComponentDefinition | null>(null);

	$: if (name) {
		loadIcon(name);
	}

	async function loadIcon(name: IconName) {
		const module = await iconMap[name]();

		iconComponent.set(module.default);
	}
</script>

{#if $iconComponent}
	<div class={className}>
		<svelte:component this={$iconComponent} {size} {color} />
	</div>
{:else}
	<p></p>
{/if}
