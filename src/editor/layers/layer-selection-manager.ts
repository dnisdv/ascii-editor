import { EventEmitter } from '@editor/event-emitter';
import type { LayerSelectionEvents } from '@editor/types/external/layers-events';
import type { Layer } from './layer';

export class LayerSelectionManager extends EventEmitter<LayerSelectionEvents> {
	private selectedIds: Set<string> = new Set();

	constructor(private getSortedLayers: () => Layer[]) {
		super();
	}

	public getSelectedLayerIds(): string[] {
		return [...this.selectedIds];
	}

	public isLayerSelected(id: string): boolean {
		return this.selectedIds.has(id);
	}

	public selectLayer(id: string, addToSelection = false): void {
		if (!addToSelection) this.selectedIds.clear();
		this.selectedIds.add(id);
		this.emit('layer::selection::changed', { selectedIds: this.getSelectedLayerIds() });
	}

	public deselectLayer(id: string): void {
		this.selectedIds.delete(id);
		this.emit('layer::selection::changed', { selectedIds: this.getSelectedLayerIds() });
	}

	public toggleLayerSelection(id: string): void {
		if (this.selectedIds.has(id)) {
			this.selectedIds.delete(id);
		} else {
			this.selectedIds.add(id);
		}
		this.emit('layer::selection::changed', { selectedIds: this.getSelectedLayerIds() });
	}

	public selectLayerRange(fromId: string, toId: string): void {
		const sorted = this.getSortedLayers();
		const fromIdx = sorted.findIndex((l) => l.id === fromId);
		const toIdx = sorted.findIndex((l) => l.id === toId);
		if (fromIdx === -1 || toIdx === -1) return;

		const start = Math.min(fromIdx, toIdx);
		const end = Math.max(fromIdx, toIdx);
		for (let i = start; i <= end; i++) {
			this.selectedIds.add(sorted[i].id);
		}
		this.emit('layer::selection::changed', { selectedIds: this.getSelectedLayerIds() });
	}

	public clearLayerSelection(): void {
		this.selectedIds.clear();
		this.emit('layer::selection::changed', { selectedIds: this.getSelectedLayerIds() });
	}
}
