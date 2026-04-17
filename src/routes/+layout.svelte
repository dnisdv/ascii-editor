<script lang="ts">
	import '../app.css';
	import '@/app.css';
	import ThemeProvider from '@/theme/ThemeProvider.svelte';
	import { Toaster } from '@components/sonner';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	import StoreProvider from '@store/Provider.svelte';

	injectAnalytics({ mode: dev ? 'development' : 'production' });
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
	<ThemeProvider>
		<slot />
		<Toaster />
	</ThemeProvider>
</StoreProvider>
