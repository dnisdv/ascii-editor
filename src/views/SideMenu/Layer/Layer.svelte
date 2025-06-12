<script lang="ts">
	import EditableText from '@components/editable-text/EditableText.svelte';
	import { Button } from '@components/button';

	import { useSelector } from '@store/useSelector';
	import { getContextMenu } from './Layer-contextMenuProvider.svelte';
	import LayerContextMenu from './Layer-contextMenu.svelte';
	import { useLayerBus } from '@/bus';
	import { writable } from 'svelte/store';
	import ThemeIcon from '@/theme/ThemeIcon.svelte';
	import { useCore } from '@/config/useCore';
	import { onMount } from 'svelte';

	const core = useCore();
	const { activeMenu, open, close } = getContextMenu();

	export let dragging = false;
	export let active = false;
	export let isSomethingDragging = false;

	let isEmpty = false;

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
		if (e.value.trim() === '') return;
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

	onMount(() => {
		const _layer = core.getLayersManager()?.getLayer(layer.id);
		if (!_layer) return;

		_layer.on('changed', () => {
			isEmpty = _layer.isEmpty();
		});
	});

	$: isOpen = $activeMenu === id;
	$: isVisible = $currentLayer?.opts?.visible ?? true;
	$: visibleIcon = isVisible ? 'eye' : 'eye-closed';
	$: isEmpty = core.getLayersManager()?.getLayer(layer.id)?.isEmpty() || false;
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
	<div
		tabindex="0"
		role="button"
		on:click={setActiveLayer}
		on:keyup|preventDefault
		class="layer h-full"
		class:dragging
		class:active
		class:isSomethingDragging
	>
		<div class="icon">
			<ThemeIcon name={isEmpty ? 'file' : 'file-type'} size={16} />
		</div>
		<EditableText
			onBlur={nameChange}
			onToggled={editableTextChange}
			bind:this={editableText}
			class="pl-1 text-xs"
			value={layer.name}
		/>
		{#if !$isEditing}
			<div
				on:mousedown|stopPropagation
				class="actions ml-1 flex gap-2"
				class:always-visible={!isVisible}
				role="button"
				tabindex="0"
			>
				<Button
					on:click={(e) => {
						e.stopPropagation();
						toggleLayerVisibility();
					}}
					class="z-50 m-0 h-auto w-auto p-0 hover:bg-none"
					variant="link"
					size="icon"
				>
					<ThemeIcon name={visibleIcon} />
				</Button>
			</div>
		{/if}
	</div>
</LayerContextMenu>

<style lang="postcss">
	.layer {
		@apply relative z-10 grid h-full w-full cursor-default items-center overflow-hidden rounded-md border-none bg-none px-1 py-1;
		grid-template-columns: 1rem 1fr auto;

		&:not(.active):not(.isSomethingDragging):hover {
			@apply bg-secondary;

			& .icon {
				@apply opacity-100;
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
		}

		&.dragging {
			@apply bg-primary bg-opacity-20;
		}

		& .actions {
			@apply z-50 hidden;
		}

		&:not(.isSomethingDragging):hover .actions {
			@apply flex;
		}

		& .actions.always-visible {
			@apply flex;
		}
	}
</style>
