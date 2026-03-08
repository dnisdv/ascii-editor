<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import type { DndListCtx, DraggableItem } from '.';
	import { isDefined } from '@lib/utils';

	export let item: DraggableItem;

	const { registerItem, unregisterItem, startDrag, dragState, registerItemHeight, updateItem } =
		getContext<DndListCtx>('dndList');
	let index: number | null = null;
	let unsubscribe: (() => void) | undefined;

	$: if (item && updateItem) {
		updateItem(item);
	}

	let initialX = 0;
	let initialY = 0;
	const dragThreshold = 5;

	let element: HTMLDivElement;

	onMount(() => {
		unsubscribe = registerItem(item)((value) => {
			index = value;
		});

		if (element) {
			const resizeObserver = new ResizeObserver(() => {
				registerItemHeight(item.id, element.clientHeight);
			});
			resizeObserver.observe(element);
			return () => resizeObserver.disconnect();
		}
	});

	onDestroy(() => {
		unregisterItem(item);
		if (unsubscribe) unsubscribe();
	});

	function handleMouseDown(e: MouseEvent): void {
		e.stopPropagation();
		if (index === null) return;
		initialX = e.clientX;
		initialY = e.clientY;
		window.addEventListener('mousemove', checkDragStart);
		window.addEventListener('mouseup', cancelDragCheck);
	}

	function checkDragStart(e: MouseEvent): void {
		const deltaX = Math.abs(e.clientX - initialX);
		const deltaY = Math.abs(e.clientY - initialY);
		if (deltaX > dragThreshold || deltaY > dragThreshold) {
			if (isDefined<number>(index)) startDrag(item, index, e);

			window.removeEventListener('mousemove', checkDragStart);
			window.removeEventListener('mouseup', cancelDragCheck);
		}
	}

	function cancelDragCheck(): void {
		window.removeEventListener('mousemove', checkDragStart);
		window.removeEventListener('mouseup', cancelDragCheck);
	}

	$: isBeingDragged = $dragState.isDragging && $dragState.draggedItem?.id === item.id;
	$: isSomethingDragging = $dragState.isDragging;
</script>

<div on:mousedown={handleMouseDown} bind:this={element}>
	<slot {isBeingDragged} {isSomethingDragging} />
</div>
