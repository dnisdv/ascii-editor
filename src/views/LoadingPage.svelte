<script>
	const ascii = `     _    ____   ____ ___ ___ 
    / \\  / ___| / ___|_ _|_ _|
   / _ \\ \\___ \\| |    | | | | 
  / ___ \\ ___) | |___ | | | | 
 /_/   \\_\\____/ \\____|___|___|
                              `;

	import { loader } from '@lib/load/load-manager';
	import { derived } from 'svelte/store';

	const barLength = 25;

	const progress = derived(loader, ($loader) => {
		return Math.round(($loader.progress / 100) * barLength);
	});
</script>

{#if $loader.isLoading}
	<div class="overlay absolute left-0 top-0 z-[999999999999999] h-full w-full bg-background">
		<div class="flex h-full flex-col items-center justify-center">
			<pre>{ascii}</pre>
			<div>{$loader.progress.toFixed(2)}%</div>
			<div class="relative">
				<div class="loader absolute top-0">[{'#'.repeat($progress)}</div>
				<div class="load-bg opacity-50">[{'#'.repeat(barLength)}]</div>
			</div>
		</div>
	</div>
{/if}
