<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { setContext, createEventDispatcher } from 'svelte';
	import { writable, type Writable, get } from 'svelte/store';
	import { type DndListEvents, type DraggableItem, type DragState } from './index';

	const dispatch = createEventDispatcher<DndListEvents>();

	const dragState = writable<DragState>({
		draggedItem: null,
		draggedIndex: null,
		isDragging: false
	});
	let linePosition: number | null = null;
	let listContainer: HTMLDivElement;
	const items: Writable<DraggableItem[]> = writable([]);
	const itemHeights = new SvelteMap<string, number>();

	function initializeDrag(item: DraggableItem, index: number): void {
		dragState.set({
			draggedItem: item,
			draggedIndex: index,
			isDragging: true
		});
		addMouseListeners();
	}

	function resetDrag(): void {
		dragState.set({
			draggedItem: null,
			draggedIndex: null,
			isDragging: false
		});
		linePosition = null;
		removeMouseListeners();
	}

	function addMouseListeners(): void {
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function removeMouseListeners(): void {
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent): void {
		const state = get(dragState);
		if (!state.isDragging) return;
		e.preventDefault();

		const relativeY = getRelativeY(e.clientY);
		linePosition = calculateTargetIndex(relativeY);
	}

	function getRelativeY(mouseY: number): number {
		const listRect = listContainer.getBoundingClientRect();
		return mouseY - listRect.top;
	}

	function calculateTargetIndex(relativeY: number): number {
		const currentItems = get(items);
		let accumulatedHeight = 0;
		for (let i = 0; i < currentItems.length; i++) {
			const item = currentItems[i];
			const itemHeight = itemHeights.get(item.id) || 0;
			if (relativeY < accumulatedHeight + itemHeight / 2) {
				return i;
			}
			accumulatedHeight += itemHeight;
		}
		return currentItems.length;
	}

	function handleMouseUp(e: MouseEvent): void {
		const state = get(dragState);
		e.preventDefault();
		if (!state.isDragging) return;
		if (linePosition !== null && state.draggedItem !== null && state.draggedIndex !== null) {
			moveDraggedItem();
		}
		resetDrag();
	}

	function moveDraggedItem(): void {
		const state = get(dragState);
		if (linePosition === null || state.draggedIndex === null || state.draggedItem === null) return;
		const adjustedPosition = adjustLinePosition(state.draggedIndex);

		if (state.draggedIndex !== adjustedPosition) {
			const currentItems = get(items);
			const updatedItems = [...currentItems];
			const [movedItem] = updatedItems.splice(state.draggedIndex, 1);

			const toItem = updatedItems[adjustedPosition] || null;

			updatedItems.splice(adjustedPosition, 0, movedItem);
			items.set(updatedItems);
			dispatch('change', {
				fromIndex: state.draggedIndex,
				toIndex: adjustedPosition,
				fromItem: movedItem,
				toItem,
				items: updatedItems
			});
		}
	}

	function adjustLinePosition(draggedIndex: number): number {
		if (linePosition === null) return 0;
		return linePosition > draggedIndex ? linePosition - 1 : linePosition;
	}

	let lineIndicatorTop = 0;
	let lineIndicatorLeft = 0;
	let lineIndicatorWidth = 0;
	$: {
		if (linePosition === null || !listContainer) {
			lineIndicatorTop = 0;
			lineIndicatorLeft = 0;
			lineIndicatorWidth = 0;
		} else {
			const currentItems = get(items);
			let top = 0;
			for (let i = 0; i < linePosition; i++) {
				const item = currentItems[i];
				top += itemHeights.get(item.id) || 0;
			}
			const rect = listContainer.getBoundingClientRect();
			lineIndicatorTop = rect.top + top;
			lineIndicatorLeft = rect.left;
			lineIndicatorWidth = rect.width;
		}
	}

	setContext('dndList', {
		registerItem: (item: DraggableItem): ((callback: (index: number) => void) => () => void) => {
			items.update((i) => {
				const updatedItems = [...i, item];
				updatedItems.sort((a, b) => a.index - b.index);
				return updatedItems;
			});

			return (callback) => {
				const unsubscribe = items.subscribe((value) => {
					const index = value.findIndex((existingItem) => existingItem.id === item.id);
					if (index !== -1) {
						callback(index);
					}
				});

				return () => unsubscribe();
			};
		},
		unregisterItem: (item: DraggableItem): void => {
			items.update((i) => i.filter((x) => x.id !== item.id));
			itemHeights.delete(item.id);
		},
		updateItem: (item: DraggableItem): void => {
			items.update((i) => {
				const index = i.findIndex((x) => x.id === item.id);
				if (index !== -1) {
					const updatedItems = [...i];
					updatedItems[index] = item;
					updatedItems.sort((a, b) => a.index - b.index);
					return updatedItems;
				}
				return i;
			});
		},
		startDrag: initializeDrag,
		dragState,
		registerItemHeight: (id: string, height: number) => {
			itemHeights.set(id, height);
		}
	});
	let isDragging = false;
	$: isDragging = $dragState.isDragging;
</script>

<div bind:this={listContainer} class="relative">
	<slot />
</div>

{#if isDragging && linePosition !== null}
	<div
		class="pointer-events-none fixed z-[9999] h-[2px] bg-primary"
		style="top: {lineIndicatorTop - 1}px; left: {lineIndicatorLeft}px; width: {lineIndicatorWidth}px;"
	></div>
{/if}
