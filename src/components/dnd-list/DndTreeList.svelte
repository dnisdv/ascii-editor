<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';
	import type { TreeDndItem, TreeChangeEventDetail } from './index';

	export let items: TreeDndItem[] = [];
	export let indent: number = 16;
	export let validateDrop: ((sourceItem: TreeDndItem, newParentId: string | null) => boolean) | undefined = undefined;
	export let onChange: ((detail: TreeChangeEventDetail) => void) | undefined = undefined;
	export let onExpandCollapsed: ((groupId: string) => void) | undefined = undefined;
	export let expandDelay: number = 500;

	const DRAG_THRESHOLD = 5;
	const PAD = 6;

	type DropInfo = {
		insertAt: number;
		depth: number;
		parentId: string | null;
		lineY: number;
		lineX: number;
		lineWidth: number;
	};

	let isDragging = false;
	let dragSourceId: string | null = null;
	let dragSourceIndex: number | null = null;
	let dropInfo: DropInfo | null = null;

	$: if (isDragging && dragSourceId !== null) {
		const newIndex = items.findIndex((item) => item.id === dragSourceId);
		if (newIndex !== -1) dragSourceIndex = newIndex;
	}

	let pendingId: string | null = null;
	let pendingIndex: number | null = null;
	let pendingX = 0;
	let pendingY = 0;

	const rowEls = new SvelteMap<string, HTMLElement>();
	let containerEl: HTMLElement;

	let hoverGroupId: string | null = null;
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	function updateHoverExpand(mouseY: number) {
		if (!onExpandCollapsed) return;

		let hoveredId: string | null = null;
		for (const item of items) {
			if (item.kind !== 'group-header' || !item.collapsed) continue;
			const el = rowEls.get(item.id);
			if (!el) continue;
			const rect = el.getBoundingClientRect();
			if (mouseY >= rect.top && mouseY <= rect.bottom) {
				hoveredId = item.id;
				break;
			}
		}

		if (hoveredId === hoverGroupId) return;
		clearHoverTimer();
		hoverGroupId = hoveredId;

		if (hoveredId !== null) {
			const id = hoveredId;
			hoverTimer = setTimeout(() => {
				onExpandCollapsed?.(id);
				hoverGroupId = null;
				hoverTimer = null;
			}, expandDelay);
		}
	}

	function clearHoverTimer() {
		if (hoverTimer !== null) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
	}

	function rowRefAction(el: HTMLElement, id: string) {
		rowEls.set(id, el);
		return {
			destroy() {
				rowEls.delete(id);
			}
		};
	}

	function onRowMousedown(id: string, index: number, e: MouseEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		pendingId = id;
		pendingIndex = index;
		pendingX = e.clientX;
		pendingY = e.clientY;
		window.addEventListener('mousemove', checkThreshold);
		window.addEventListener('mouseup', cancelPending);
	}

	function checkThreshold(e: MouseEvent) {
		if (
			Math.abs(e.clientX - pendingX) > DRAG_THRESHOLD ||
			Math.abs(e.clientY - pendingY) > DRAG_THRESHOLD
		) {
			window.removeEventListener('mousemove', checkThreshold);
			window.removeEventListener('mouseup', cancelPending);
			if (pendingId !== null && pendingIndex !== null) {
				beginDrag(pendingId, pendingIndex, e);
			}
		}
	}

	function cancelPending() {
		window.removeEventListener('mousemove', checkThreshold);
		window.removeEventListener('mouseup', cancelPending);
		pendingId = null;
		pendingIndex = null;
	}

	function beginDrag(id: string, index: number, e: MouseEvent) {
		isDragging = true;
		dragSourceId = id;
		dragSourceIndex = index;
		pendingId = null;
		pendingIndex = null;
		window.addEventListener('mousemove', onDragMove);
		window.addEventListener('mouseup', onDragEnd);
		onDragMove(e);
	}

	function onDragMove(e: MouseEvent) {
		if (!isDragging || dragSourceIndex === null) return;
		dropInfo = computeDropInfo(e.clientX, e.clientY, dragSourceIndex);
		updateHoverExpand(e.clientY);
	}

	function onDragEnd() {
		window.removeEventListener('mousemove', onDragMove);
		window.removeEventListener('mouseup', onDragEnd);
		if (dropInfo !== null && dragSourceIndex !== null && dragSourceId !== null) {
			onChange?.({
				sourceIndex: dragSourceIndex,
				insertAt: dropInfo.insertAt,
				parentId: dropInfo.parentId
			});
		}
		isDragging = false;
		dragSourceId = null;
		dragSourceIndex = null;
		dropInfo = null;
		clearHoverTimer();
		hoverGroupId = null;
	}

	onDestroy(() => {
		window.removeEventListener('mousemove', checkThreshold);
		window.removeEventListener('mouseup', cancelPending);
		window.removeEventListener('mousemove', onDragMove);
		window.removeEventListener('mouseup', onDragEnd);
		clearHoverTimer();
	});

	function computeDropInfo(mouseX: number, mouseY: number, sourceIndex: number): DropInfo | null {
		if (!containerEl) return null;
		const cr = containerEl.getBoundingClientRect();
		const workList = items.filter((_, i) => i !== sourceIndex);

		let rawInsertAt = items.length;
		let lineY = cr.bottom;

		for (let oi = 0; oi < items.length; oi++) {
			const el = rowEls.get(items[oi].id);
			if (el) {
				const rect = el.getBoundingClientRect();
				if (mouseY < rect.top + rect.height / 2) {
					rawInsertAt = oi;
					lineY = rect.top;
					break;
				}
				lineY = rect.bottom;
			}
		}

		if (workList.length === 0) lineY = cr.top;

		const insertAt = rawInsertAt > sourceIndex ? rawInsertAt - 1 : rawInsertAt;

		const above = insertAt > 0 ? workList[insertAt - 1] : null;
		let below = insertAt < workList.length ? workList[insertAt] : null;

		let maxDepth = above ? above.depth : 0;
		if (above?.kind === 'group-header' && !above.collapsed) {
			maxDepth = above.depth + 1;
		}

		const relX = Math.max(0, mouseX - cr.left - PAD);
		const cursorDepth = Math.floor(relX / indent);
		let depth = Math.min(maxDepth, Math.max(0, cursorDepth));

		const minDepth = below ? below.depth : 0;
		if (above && below && maxDepth > minDepth && mouseY >= lineY) {
			const belowEl = rowEls.get(below.id);
			if (belowEl) {
				const belowRect = belowEl.getBoundingClientRect();
				const zoneHeight = belowRect.height / 2;
				const levels = maxDepth - minDepth;
				const bandSize = zoneHeight / levels;
				const distIntoBelow = mouseY - lineY;
				const steps = Math.min(levels, Math.floor(distIntoBelow / bandSize));
				depth = Math.min(depth, maxDepth - steps);
			}
		}

		let finalInsertAt = insertAt;
		if (below && depth < below.depth) {
			while (finalInsertAt < workList.length && workList[finalInsertAt].depth > depth) {
				finalInsertAt++;
			}
			below = finalInsertAt < workList.length ? workList[finalInsertAt] : null;
			if (below) {
				const el = rowEls.get(below.id);
				if (el) lineY = el.getBoundingClientRect().top;
			} else {
				lineY = cr.bottom;
			}
		}

		const parentId = resolveParentAtDepth(workList, finalInsertAt, depth);

		const sourceItem = items[sourceIndex];
		if (validateDrop && !validateDrop(sourceItem, parentId)) {
			return null;
		}

		const lineX = cr.left + PAD + depth * indent;
		const lineWidth = Math.max(0, cr.width - PAD - depth * indent);

		return { insertAt: finalInsertAt, depth, parentId, lineY, lineX, lineWidth };
	}

	function resolveParentAtDepth(
		workList: TreeDndItem[],
		insertAt: number,
		depth: number
	): string | null {
		if (depth === 0) return null;
		for (let i = insertAt - 1; i >= 0; i--) {
			const item = workList[i];
			if (item.kind === 'group-header' && item.depth === depth - 1) {
				return item.id;
			}
			if (item.depth < depth - 1) break;
		}
		return null;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={containerEl} role="list" class="flex flex-col">
	{#each items as item, i (item.id)}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="listitem"
			use:rowRefAction={item.id}
			on:mousedown={(e) => onRowMousedown(item.id, i, e)}
			class:pointer-events-none={isDragging && dragSourceId === item.id}
			style="padding-left: {item.depth * indent}px"
		>
			<slot {item} isBeingDragged={isDragging && dragSourceId === item.id} {isDragging} />
		</div>
	{/each}
</div>

{#if isDragging && dropInfo}
	<div
		class="pointer-events-none fixed z-[9999] h-[2px] bg-primary"
		style="top: {dropInfo.lineY - 1}px; left: {dropInfo.lineX}px; width: {dropInfo.lineWidth}px;"
	></div>
{/if}
