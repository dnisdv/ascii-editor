<script lang="ts">
	import Editor from './Editor.svelte';
	import LoadingPage from '@views/LoadingPage.svelte';
	import MobileUnavailable from '@views/MobileUnavailable.svelte';

	const isMobile = globalThis.window
		? window.matchMedia('(max-width: 768px)').matches
		: false;
</script>

<svelte:head>
	<title>ASCII Editor</title>
</svelte:head>

<MobileUnavailable />

{#if !isMobile}
	<LoadingPage />
	<Editor />
{/if}
