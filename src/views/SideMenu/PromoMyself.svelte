<script lang="ts">
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import Button from '@components/button/button.svelte';
	import { cn } from '@lib/utils.js';

	let className: string | undefined = undefined;
	export { className as class };
</script>

<a target="_blank" href="https://github.com/dnisdv/ascii-editor">
	<Button class={cn('flex items-center gap-1.5', className)} variant="secondary" size="xxs">
		<ThemeIcon name="github" />
		<span class="text-xs">@dnisdv</span>
	</Button>
</a>
