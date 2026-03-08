import type { AsciiRenderingDeps, IAsciiRenderingStrategy } from './ascii-rendering-strategy';

export class AsciiRenderDefaultStrategy implements IAsciiRenderingStrategy {
	public dispose(): void {}

	public render(deps: AsciiRenderingDeps): void {
		const layersManager = deps.layersManager;
		const visibleLayers = layersManager.getAllVisibleLayersSorted();

		for (const layer of visibleLayers) {
			const layerApi = layersManager.getLayer(layer.id);
			const objects = layerApi ? layerApi.getObjects() : layer.getObjects();

			for (const smartObject of objects) smartObject.render({ ...deps, opacity: 1 });
		}
	}
}
