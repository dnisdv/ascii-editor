import type { ICanvas } from './canvas.type';

export type RenderCallback = () => void;

export enum SubscriptionType {
	PRE_RENDER = 'PRE_RENDER',
	COMPONENT = 'COMPONENT',
	ANY_COMPONENT = 'ANY_COMPONENT',
	POST_RENDER = 'POST_RENDER'
}

export interface IRenderManager {
	register(namespace: string, id: string, callback: RenderCallback, canvasToFlush?: ICanvas): void;
	unregister(namespace: string, id: string): void;

	subscribe(
		type:
			| SubscriptionType.PRE_RENDER
			| SubscriptionType.ANY_COMPONENT
			| SubscriptionType.POST_RENDER,
		callback: RenderCallback
	): () => void;
	subscribe(
		type: SubscriptionType.COMPONENT,
		namespace: string,
		id: string,
		callback: RenderCallback
	): () => void;

	subscribePreRender(callback: RenderCallback): () => void;
	subscribePostRender(callback: RenderCallback): () => void;
	subscribeAnyComponent(callback: RenderCallback): () => void;
	subscribeComponent(namespace: string, id: string, callback: RenderCallback): () => void;

	requestRenderOnly(namespace: string, id: string): void;
	requestRender(): void;
	requestRenderFn(fn?: () => void): void;
	requestRenderAll(): void;
	dispose(): void;
}
