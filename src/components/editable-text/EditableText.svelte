<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { cn } from '@lib/utils.js';

	let input: HTMLInputElement;

	export let value = 'Click to edit';
	export let trigger: 'click' | 'dblclick' = 'dblclick';

	type EventDetailMap = {
		toggled: { isEditing: boolean };
		change: { value: string };
		editing: { isEditing: boolean };
		blur: { value: string };
	};

	export let onToggled: (detail: EventDetailMap['toggled']) => void = () => {};
	export let onChange: (detail: EventDetailMap['change']) => void = () => {};
	export let onEditing: (detail: EventDetailMap['editing']) => void = () => {};
	export let onBlur: (detail: EventDetailMap['blur']) => void = () => {};

	export let isEditing = false;
	let className: string | undefined = undefined;
	let inputClassName: string | undefined = undefined;
	let blockClassName: string | undefined = undefined;

	let clickTimeout: ReturnType<typeof setTimeout> | null = null;
	let inputValue = value;

	$: if (!isEditing && value !== inputValue) {
		inputValue = value;
	}

	function toggle() {
		isEditing = !isEditing;
		onToggled({ isEditing });

		if (!isEditing && inputValue !== value) {
			onChange({ value: inputValue });
		}
	}

	function handleBeforeUnload() {
		if (isEditing) {
			toggle();
			onBlur({ value: inputValue });
			onChange({ value: inputValue });
		}
	}

	const handleClick = () => {
		if (trigger === 'click') {
			startEditing();
		} else {
			if (clickTimeout) {
				clearTimeout(clickTimeout);
				clickTimeout = null;
				startEditing();
			} else {
				clickTimeout = setTimeout(() => {
					clickTimeout = null;
				}, 300);
			}
		}
	};

	function startEditing() {
		toggle();
		tick().then(() => {
			setTimeout(() => {
				input.focus();
			}, 10);
		});
	}

	$: if (isEditing) {
		onEditing({ isEditing: isEditing });
	}

	function handleWindowClick(event: MouseEvent) {
		if (isEditing && input && !input.contains(event.target as Node)) {
			input.blur();
		}
	}

	onMount(() => {
		window.addEventListener('click', handleWindowClick);
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('click', handleWindowClick);
		};
	});

	export {
		className as class,
		inputClassName as inputClass,
		blockClassName as blockClass,
		startEditing
	};
</script>

{#if isEditing}
	<input
		on:mousedown={(e) => e.stopPropagation()}
		bind:this={input}
		bind:value={inputValue}
		class={cn(
			'h-auto w-full rounded-sm bg-transparent p-0 text-inherit',
			className,
			inputClassName
		)}
		type="text"
		on:focus={() => input.select()}
		on:keyup|stopPropagation
		on:keydown={(event) => {
			event.stopPropagation();

			if (event.key === 'Enter') {
				event.preventDefault();
				input.blur();
			}
		}}
		on:blur={() => {
			toggle();
			onBlur({ value: inputValue });
			onChange({ value: inputValue });
		}}
	/>
{:else}
	<button
		tabindex="0"
		class={cn(
			'block h-auto w-auto max-w-full overflow-hidden text-ellipsis whitespace-pre text-start text-inherit',
			className,
			blockClassName
		)}
		on:click={handleClick}
	>
		{value}
	</button>
{/if}
