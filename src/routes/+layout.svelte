<script lang="ts">
	import '../app.css';
	import '@/app.css';
	import EditorBusProvider from '@/bus/EditorBusProvider.svelte';
	import ThemeProvider from '@/theme/ThemeProvider.svelte';
	import { Toaster } from '@components/sonner';

	import StoreProvider from '@store/Provider.svelte';
</script>

<StoreProvider>
	<EditorBusProvider>
		<ThemeProvider>
			<slot />
			<Toaster />
		</ThemeProvider>
	</EditorBusProvider>
</StoreProvider>
