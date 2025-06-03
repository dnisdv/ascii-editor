<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { Button } from '@components/button';

	import { useSelector } from '@store/useSelector';
	import { getContextMenu } from './Layer-contextMenuProvider.svelte';
	import LayerContextMenu from './Layer-contextMenu.svelte';
	import { useLayerBus } from '@/bus';
	import { writable } from 'svelte/store';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';

	export let dragging = false;
	export let active = false;
	export let isSomethingDragging = false;

	const { activeMenu, open, close } = getContextMenu();

	export let layer;
	export let id;

	const currentLayer = useSelector((store) => store.layers.data[id]);
	const isEditing = writable(false);

	const layerBus = useLayerBus();

	const setActiveLayer = () => {
		layerBus.emit('layer::change_active::request', { id });
	};

	const onOpenChange = (isOpen: boolean) => {
		if (isOpen) return open(id);
		close();
	};

	let editableText: EditableText;

	const startLayerRename = () => {
		editableText.startEditing();
	};

	const nameChange = (e: { value: string }) => {
		const newName = e.value;
		layerBus.emit('layer::update::request', { id, name: newName });
	};

	const remove = () => {
		layerBus.emit('layer::remove::request', { id });
	};

	const copyName = () => {
		const navigator = window.navigator;
		if (navigator.clipboard) {
			navigator.clipboard.writeText(layer.name);
		}
	};

	const toggleLayerVisibility = () => {
		layerBus.emit('layer::update::request', {
			id,
			opts: { visible: !isVisible }
		});
	};

	const editableTextChange = (e: { isEditing: boolean }) => {
		isEditing.set(e.isEditing);
	};

	$: isOpen = $activeMenu === id;
	$: isVisible = $currentLayer?.opts?.visible ?? true;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
</script>

<LayerContextMenu
	{isOpen}
	{onOpenChange}
	{visibleIcon}
	on:rename={startLayerRename}
	on:copyName={copyName}
	on:toggleVisibility={toggleLayerVisibility}
	on:delete={remove}
>
	<button
		on:click={setActiveLayer}
		class="layer h-full"
		class:dragging
		class:active
		class:isSomethingDragging
	>
		<div class="icon">
			<ThemeIcon name="file" size={16} />
		</div>
		<EditableText
			onBlur={nameChange}
			onToggled={editableTextChange}
			bind:this={editableText}
			class="text-xs"
			value={layer.name}
		/>
		{#if !$isEditing}
			<div
				on:mousedown|stopPropagation
				class="actions flex gap-2"
				class:always-visible={!isVisible}
				role="button"
				tabindex="0"
			>
				<Button
					on:click={toggleLayerVisibility}
					class="m-0 h-auto w-auto p-0 hover:bg-none"
					variant="link"
					size="icon"
				>
					<ThemeIcon name={visibleIcon} />
				</Button>
			</div>
		{/if}
	</button>
</LayerContextMenu>

<style lang="postcss">
	.layer {
		@apply relative z-10 grid h-full w-full cursor-default items-center gap-1 overflow-hidden rounded-md border-none bg-none px-1 py-1;
		grid-template-columns: 1rem 1fr auto;

		&:not(.active):not(.isSomethingDragging):hover {
			@apply bg-secondary;

			& .icon {
				@apply opacity-100;
			}

			& .actions {
				@apply flex;
			}
		}

		& .icon {
			@apply opacity-50;
		}

		&.active {
			@apply bg-primary bg-opacity-20;

			& .icon {
				@apply opacity-100;
			}

			& .actions {
				@apply flex;
			}
		}

		&.dragging {
			@apply bg-primary bg-opacity-20;
		}

		& .actions {
			@apply z-50 hidden;
		}

		& .actions.always-visible {
			@apply flex;
		}
	}
</style>
