import type { ICanvas, IRenderManager } from './types';
import type { Surface } from 'canvaskit-wasm';

export enum SubscriptionType {
	PRE_RENDER = 'PRE_RENDER',
	COMPONENT = 'COMPONENT',
	ANY_COMPONENT = 'ANY_COMPONENT',
	POST_RENDER = 'POST_RENDER'
}

export type RenderCallback = () => void;

let renderManagerId = 0;

export class RenderManager implements IRenderManager {
	public id = renderManagerId++;
	private renderQueue: Set<string> = new Set();
	private callbacks: Map<string, { callback: RenderCallback; canvas?: ICanvas }> = new Map();

	private isRendering: boolean = false;
	private animationFrameId: number | null = null;

	private preRenderSubscribers: Map<RenderCallback, number> = new Map();
	private postRenderSubscribers: Map<RenderCallback, number> = new Map();
	private anyComponentSubscribers: Map<RenderCallback, number> = new Map();
	private componentSubscribers: Map<string, Map<RenderCallback, number>> = new Map();

	private makeComponentKey(namespace: string, id: string): string {
		return `${namespace}:${id}`;
	}

	private addSubscription(subMap: Map<RenderCallback, number>, callback: RenderCallback): void {
		const currentCount = subMap.get(callback) ?? 0;
		subMap.set(callback, currentCount + 1);
	}

	private removeSubscription(subMap: Map<RenderCallback, number>, callback: RenderCallback): void {
		const currentCount = subMap.get(callback) ?? 0;
		if (currentCount > 1) {
			subMap.set(callback, currentCount - 1);
		} else {
			subMap.delete(callback);
		}
	}

	register(namespace: string, id: string, callback: RenderCallback, canvas?: ICanvas): void {
		const key = this.makeComponentKey(namespace, id);
		this.callbacks.set(key, { callback, canvas });
	}

	unregister(namespace: string, id: string): void {
		const key = this.makeComponentKey(namespace, id);
		this.callbacks.delete(key);
		this.renderQueue.delete(key);

		const subMap = this.componentSubscribers.get(key);
		if (subMap) {
			subMap.clear();
			this.componentSubscribers.delete(key);
		}
	}

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
	subscribe(
		type: SubscriptionType,
		namespaceOrCallback: string | RenderCallback,
		idOrCallback?: string | RenderCallback,
		maybeCallback?: RenderCallback
	): () => void {
		if (type === SubscriptionType.COMPONENT) {
			const namespace = namespaceOrCallback as string;
			const id = idOrCallback as string;
			const callback = maybeCallback!;
			return this.subscribeComponent(namespace, id, callback);
		} else {
			const callback = namespaceOrCallback as RenderCallback;
			switch (type) {
				case SubscriptionType.PRE_RENDER:
					return this.subscribePreRender(callback);
				case SubscriptionType.ANY_COMPONENT:
					return this.subscribeAnyComponent(callback);
				case SubscriptionType.POST_RENDER:
					return this.subscribePostRender(callback);
				default:
					throw new Error(`Unsupported subscription type: ${type}`);
			}
		}
	}

	subscribePreRender(callback: RenderCallback): () => void {
		this.addSubscription(this.preRenderSubscribers, callback);
		return () => this.removeSubscription(this.preRenderSubscribers, callback);
	}

	subscribePostRender(callback: RenderCallback): () => void {
		this.addSubscription(this.postRenderSubscribers, callback);
		return () => this.removeSubscription(this.postRenderSubscribers, callback);
	}

	subscribeAnyComponent(callback: RenderCallback): () => void {
		this.addSubscription(this.anyComponentSubscribers, callback);
		return () => this.removeSubscription(this.anyComponentSubscribers, callback);
	}

	subscribeComponent(namespace: string, id: string, callback: RenderCallback): () => void {
		const key = this.makeComponentKey(namespace, id);
		let subMap = this.componentSubscribers.get(key);
		if (!subMap) {
			subMap = new Map();
			this.componentSubscribers.set(key, subMap);
		}
		this.addSubscription(subMap, callback);

		return () => {
			const currentSubMap = this.componentSubscribers.get(key);
			if (currentSubMap) {
				this.removeSubscription(currentSubMap, callback);
				if (currentSubMap.size === 0) {
					this.componentSubscribers.delete(key);
				}
			}
		};
	}

	requestRenderOnly(namespace: string, id: string): void {
		const key = this.makeComponentKey(namespace, id);
		if (!this.callbacks.has(key)) {
			return;
		}
		for (const key of this.callbacks.keys()) {
			this.renderQueue.add(key);
		}
		this.scheduleRender();
	}

	requestRender(): void {
		this.requestRenderAll();
	}

	requestRenderAll(): void {
		for (const key of this.callbacks.keys()) {
			this.renderQueue.add(key);
		}
		this.scheduleRender();
	}

	requestRenderFn(fn?: () => void): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		this.isRendering = true;

		for (const key of this.callbacks.keys()) {
			this.renderQueue.add(key);
		}

		const surfacesToFlush = this.performRender(fn);
		this.flushSurfaces(surfacesToFlush);

		this.isRendering = false;
	}

	private scheduleRender(): void {
		if (this.isRendering || this.animationFrameId !== null) return;

		this.isRendering = true;
		this.animationFrameId = requestAnimationFrame(() => {
			const surfacesToFlush = this.performRender();
			this.flushSurfaces(surfacesToFlush);
			this.isRendering = false;
			this.animationFrameId = null;
		});
	}

	private performRender(midFn?: () => void): Set<Surface> {
		const surfacesToFlushThisFrame: Set<Surface> = new Set();
		const canvasesToClearThisFrame: Set<ICanvas> = new Set();

		const queueToProcess = new Set(this.renderQueue);

		for (const key of queueToProcess) {
			const registeredEntry = this.callbacks.get(key);
			if (registeredEntry && registeredEntry.canvas) {
				canvasesToClearThisFrame.add(registeredEntry.canvas);
			}
		}

		for (const [cb] of this.preRenderSubscribers) {
			cb();
		}

		for (const canvas of canvasesToClearThisFrame) {
			if (canvas.skCanvas && canvas.canvasKit && canvas.surface && !canvas.surface.isDeleted()) {
				canvas.skCanvas.clear(canvas.canvasKit.TRANSPARENT);
			}
		}

		this.renderQueue.clear();

		for (const key of queueToProcess) {
			const registeredEntry = this.callbacks.get(key);
			if (registeredEntry) {
				const { callback, canvas } = registeredEntry;

				const componentSubs = this.componentSubscribers.get(key);
				if (componentSubs) {
					for (const [compCb] of componentSubs) compCb();
				}
				for (const [anyCompCb] of this.anyComponentSubscribers) anyCompCb();

				callback();

				if (canvas && canvas.surface && !canvas.surface.isDeleted()) {
					surfacesToFlushThisFrame.add(canvas.surface);
				}
			}
		}

		if (midFn) {
			midFn();
		}

		for (const [cb] of this.postRenderSubscribers) {
			cb();
		}

		return surfacesToFlushThisFrame;
	}

	private flushSurfaces(surfaces: Set<Surface>): void {
		for (const surface of surfaces) {
			if (surface && !surface.isDeleted()) {
				surface.flush();
			}
		}
	}

	dispose(): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		this.isRendering = false;
		this.renderQueue.clear();
		this.callbacks.clear();
		this.preRenderSubscribers.clear();
		this.postRenderSubscribers.clear();
		this.anyComponentSubscribers.clear();
		this.componentSubscribers.clear();
	}
}
