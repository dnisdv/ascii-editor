import type { Writable } from 'svelte/store';

export type DraggableItem = {
	id: string;
	index: number;
	[x: string]: unknown;
	updatedAt?: string;
};

export interface ChangeEventDetail {
	fromIndex: number;
	toIndex: number;
	fromItem: DraggableItem;
	toItem: DraggableItem | null;
	items: (DraggableItem & unknown)[];
}

export interface DndListEvents {
	change: ChangeEventDetail;
}

export interface DndListCtx {
	registerItem: (item: unknown) => (callback: (index: number) => void) => () => void;
	unregisterItem: (item: unknown) => void;
	updateItem: (item: unknown) => void;
	startDrag: (item: unknown, index: number, e: MouseEvent) => void;
	dragState: Writable<DragState>;
	registerItemHeight: (id: string, height: number) => void;
}

export interface DragState {
	draggedItem: DraggableItem | null;
	draggedIndex: number | null;
	isDragging: boolean;
}

export type TreeDndItem = {
	id: string;
	kind: 'layer' | 'group-header';
	depth: number;
	parentGroupId: string | null;
	collapsed?: boolean;
};

export interface TreeChangeEventDetail {
	sourceIndex: number;
	insertAt: number;
	parentId: string | null;
}

export interface DndTreeListEvents {
	change: TreeChangeEventDetail;
}
