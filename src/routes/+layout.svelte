<script lang="ts">
	import '../app.css';
	import '@/app.css';
	import EditorBusProvider from '@/bus/EditorBusProvider.svelte';
	import ThemeProvider from '@/theme/ThemeProvider.svelte';
	import { Toaster } from '@components/sonner';

	import StoreProvider from '@store/Provider.svelte';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
		rel="stylesheet"
	/>

	<link href="/fonts/LiberationMono-Regular.ttf" rel="stylesheet" />
</svelte:head>

<StoreProvider>
	<EditorBusProvider>
		<ThemeProvider>
			<slot />
			<Toaster />
		</ThemeProvider>
	</EditorBusProvider>
</StoreProvider>
