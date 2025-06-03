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

	let isEditing = false;
	let className: string | undefined = undefined;

	let clickTimeout: ReturnType<typeof setTimeout> | null = null;
	let inputValue = value;

	$: if (!isEditing && value !== inputValue) {
		inputValue = value;
	}

	function toggle() {
		isEditing = !isEditing;
		onToggled({ isEditing });

		if (!isEditing && inputValue !== value) {
			value = inputValue;
			onChange({ value });
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

	export { className as class, startEditing };
</script>

{#if isEditing}
	<input
		bind:this={input}
		bind:value={inputValue}
		class={cn(
			' m-0 -ml-0.5 h-auto w-full rounded-sm bg-transparent p-0 pl-0.5 text-inherit shadow-primary outline outline-1 outline-primary focus:outline focus:outline-primary active:outline-primary',
			className
		)}
		type="text"
		on:focus={() => input.select()}
		on:keydown={(event) => {
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
			'block h-auto w-auto overflow-hidden text-ellipsis text-start text-inherit',
			className
		)}
		on:click={handleClick}
	>
		{value}
	</button>
{/if}
