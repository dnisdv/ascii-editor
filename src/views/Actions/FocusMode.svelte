<script lang="ts">
	import * as Tooltip from '@components/tooltip';
	import { useConfig } from '@/config/useConfig';
	import { AsciiRenderMode } from '@editor/canvas/strategies/ascii-rendering.type';
	import { useTheme } from '@/theme';
	import FocusModeToggle from './FocusModeToggle.svelte';

	const { config } = useConfig();
	const { theme } = useTheme();

	function toggleFocusMode(checked: boolean) {
		let newMode = checked ? AsciiRenderMode.FOCUS_MODE : AsciiRenderMode.DEFAULT;
		config.setRenderingMode(newMode);
	}

	$: currThemeImage =
		$theme === 'dark' ? '/images/focus-mode-dark.png' : '/images/focus-mode-light.png';
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<FocusModeToggle builders={[builder]} onToggle={toggleFocusMode} />
	</Tooltip.Trigger>
	<Tooltip.Content sideOffset={12} align="end" class="m-0 w-[276px] p-1">
		<div class="w-full">
			<img class="object-cover" src={currThemeImage} alt="focus mode example" />
		</div>
		<div class="px-3">
			<p class="mt-4 text-base font-bold">Focus Mode</p>
			<p class="mb-3 mt-2 text-sm font-normal">
				Highlight active layers by displaying their symbols at full opacity, while other layers are
				shown with reduced visibility for easier differentiation and focused editing. This allows
				you to perceive elements behind your active work.
			</p>
		</div>
	</Tooltip.Content>
</Tooltip.Root>

<style>
</style>
