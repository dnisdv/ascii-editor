<script lang="ts">
	import { useTheme } from '@/theme/useTheme';
	import Button from '@components/button/button.svelte';

	import * as Tooltip from '@components/tooltip';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	const { toggleTheme, theme } = useTheme();

	const toggle = () => {
		toggleTheme();
	};

	let currThemeIcon = 'moon';
	$: currThemeIcon = $theme === 'dark' ? 'sun' : 'moon';
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<div class="flex">
			<Button builders={[builder]} on:click={toggle} size="icon-sm" variant="ghost">
				<ThemeIcon size={16} name={currThemeIcon} />
			</Button>
		</div>
	</Tooltip.Trigger>
	<Tooltip.Content>{$theme === 'dark' ? 'Light' : 'Dark'}</Tooltip.Content>
</Tooltip.Root>
