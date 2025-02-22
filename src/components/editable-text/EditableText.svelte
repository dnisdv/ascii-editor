<script lang="ts">
	import { createEventDispatcher, tick, onMount } from 'svelte';
	import { cn } from '@lib/utils.js';

	let input: HTMLInputElement;

	export let value = 'Click to edit';
	export let trigger: 'click' | 'dblclick' = 'dblclick';

	const dispatch = createEventDispatcher();
	let isEditing = false;
	let className: string | undefined = undefined;

	let clickTimeout: NodeJS.Timeout | null = null;
	let inputValue = value;

	$: if (!isEditing && value !== inputValue) {
		inputValue = value;
	}

	function toggle() {
		isEditing = !isEditing;
		dispatch('toggled', { isEditing });

		if (!isEditing && inputValue !== value) {
			value = inputValue;
			dispatch('change', { value });
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
				input.select();
			}, 10);
		});
	}

	$: if (isEditing) {
		dispatch('editing', { isEditing });
	}

	function handleWindowClick(event: MouseEvent) {
		if (isEditing && input && !input.contains(event.target as Node)) {
			input.blur();
		}
	}

	onMount(() => {
		window.addEventListener('click', handleWindowClick);
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
		on:keydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				input.blur();
			}
		}}
		on:blur={() => {
			toggle();
			dispatch('blur', { value: inputValue });
			dispatch('change', { value: inputValue });
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
