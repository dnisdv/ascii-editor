import type { AsciiRenderingDeps, IAsciiRenderingStrategy } from './ascii-rendering-strategy';
export class AsciiRenderFocusStrategy implements IAsciiRenderingStrategy {
	public dispose(): void {}

	public render(deps: AsciiRenderingDeps): void {
		const { layersManager } = deps;
		const visibleLayers = layersManager.getAllVisibleLayersSorted();
		const activeLayerId = layersManager.getActiveLayerKey();

		for (const layer of visibleLayers) {
			const realLayer = layersManager.getLayer(layer.id);
			const isTempLayer = !realLayer;

			let layerOpacity = 1;
			if (!isTempLayer && layer.id !== activeLayerId) layerOpacity = 0.2;

			const objects = realLayer ? realLayer.getObjects() : layer.getObjects();
			for (const smartObject of objects) smartObject.render({ ...deps, opacity: layerOpacity });
		}
	}
}
