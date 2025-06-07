export interface ActionHandler<T extends BaseAction> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	apply(action: T, target: any): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	revert(action: T, target: any): void;
}

export interface BaseAction {
	type: string;
	before: unknown;
	after: unknown;
	targetId: string;
	batchId?: string;
}

export interface BatchConfig {
	id?: string;
	targetId?: string;
	type?: string;
}

type Action = BaseAction;

export interface ActionHandler<T extends BaseAction> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	apply(action: T, target: any): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	revert(action: T, target: any): void;
}

type HistorySubscriber = () => void;
type HistorySubscriberWithAction = (action: Action) => void;

export class HistoryManager {
	private stack: Action[] = [];
	private currentIndex: number = -1;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private handlers: Map<string, ActionHandler<any>> = new Map();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private targets: Map<string, any> = new Map();

	private isApplying = false;

	private activeBatches: Map<
		string,
		{
			config: BatchConfig;
			actions: Action[];
		}
	> = new Map();

	private beforeUndoSubscribers: HistorySubscriber[] = [];
	private afterUndoSubscribers: HistorySubscriber[] = [];
	private beforeRedoSubscribers: HistorySubscriber[] = [];
	private afterRedoSubscribers: HistorySubscriber[] = [];
	private beforeApplyActionSubscribers: HistorySubscriberWithAction[] = [];
	private afterApplyActionSubscribers: HistorySubscriber[] = [];

	private generateBatchId(): string {
		return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	}

	private canAddToBatch(batchId: string, action: Action): boolean {
		const batch = this.activeBatches.get(batchId);
		if (!batch) return false;

		const { config } = batch;

		if (!config.targetId && !config.type) return true;
		if (config.targetId && action.targetId !== config.targetId) return false;
		if (config.type && action.type !== config.type) return false;

		return true;
	}

	public clear() {
		this.stack = [];
	}

	public getHistory() {
		return this.stack;
	}

	public onBeforeUndo(subscriber: HistorySubscriber): () => void {
		this.beforeUndoSubscribers.push(subscriber);
		return () => {
			this.beforeUndoSubscribers = this.beforeUndoSubscribers.filter((sub) => sub !== subscriber);
		};
	}

	public onAfterUndo(subscriber: HistorySubscriber): () => void {
		this.afterUndoSubscribers.push(subscriber);
		return () => {
			this.afterUndoSubscribers = this.afterUndoSubscribers.filter((sub) => sub !== subscriber);
		};
	}

	public onBeforeRedo(subscriber: HistorySubscriber): () => void {
		this.beforeRedoSubscribers.push(subscriber);
		return () => {
			this.beforeRedoSubscribers = this.beforeRedoSubscribers.filter((sub) => sub !== subscriber);
		};
	}

	public onAfterRedo(subscriber: HistorySubscriber): () => void {
		this.afterRedoSubscribers.push(subscriber);
		return () => {
			this.afterRedoSubscribers = this.afterRedoSubscribers.filter((sub) => sub !== subscriber);
		};
	}

	public onAfterApplyActionSubscriber(subscriber: HistorySubscriber) {
		this.afterApplyActionSubscribers.push(subscriber);
		return () => {
			this.afterApplyActionSubscribers = this.afterApplyActionSubscribers.filter(
				(sub) => sub !== subscriber
			);
		};
	}

	public onBeforeApplyActionSubscriber(subscriber: HistorySubscriberWithAction) {
		this.beforeApplyActionSubscribers.push(subscriber);
		return () => {
			this.beforeApplyActionSubscribers = this.beforeApplyActionSubscribers.filter(
				(sub) => sub !== subscriber
			);
		};
	}

	public beginBatch(config: BatchConfig = {}): string {
		const id = config.id || this.generateBatchId();

		if (this.activeBatches.has(id)) {
			throw new Error(`Batch with ID ${id} already exists`);
		}

		this.activeBatches.set(id, {
			config,
			actions: []
		});

		return id;
	}

	public applyAction(action: Action, config?: { batchId?: string; applyAction?: boolean }): void {
		this.beforeApplyActionSubscribers.forEach((subscriber) => subscriber(action));
		if (this.isApplying) return;

		const handler = this.handlers.get(action.type);
		const target = this.targets.get(action.targetId);

		if (!handler) throw new Error(`No handler registered for action type: ${action.type}`);
		if (!target) throw new Error(`No target registered with ID: ${action.targetId}`);

		if (config?.batchId) {
			const batch = this.activeBatches.get(config.batchId);
			if (!batch) {
				throw new Error(`Batch with ID ${config.batchId} not found`);
			}

			if (this.canAddToBatch(config.batchId, action)) {
				batch.actions.push(action);
				return;
			}
		}

		if (config?.applyAction !== false) {
			handler.apply(action, target);
		}

		this.stack = this.stack.slice(0, this.currentIndex + 1);
		this.stack.push(action);
		this.currentIndex++;

		this.afterApplyActionSubscribers.forEach((subscriber) => subscriber());
	}

	public commitBatch(batchId: string): void {
		const batch = this.activeBatches.get(batchId);
		if (!batch) {
			throw new Error(`Batch with ID ${batchId} not found`);
		}

		if (batch.actions.length === 0) {
			this.activeBatches.delete(batchId);
			return;
		}

		batch.actions.forEach((action) => {
			const handler = this.handlers.get(action.type);
			const target = this.targets.get(action.targetId);

			if (!handler || !target) {
				throw new Error('Handler or target not found for batch action');
			}

			handler.apply(action, target);
		});

		const compositeAction: BaseAction = {
			type: `COMPOSITE_${batchId}`,
			before: batch.actions.map((a) => a.before),
			after: batch.actions.map((a) => a.after),
			targetId: batch.actions[0].targetId
		};

		if (!this.handlers.has(compositeAction.type)) {
			this.registerHandler(compositeAction.type, {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				apply: (_action: BaseAction, target: any) => {
					batch.actions.forEach((subAction) => {
						const handler = this.handlers.get(subAction.type);
						if (handler) {
							handler.apply(subAction, target);
						}
					});
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				revert: (_action: BaseAction, target: any) => {
					for (let i = batch.actions.length - 1; i >= 0; i--) {
						const subAction = batch.actions[i];
						const handler = this.handlers.get(subAction.type);
						if (handler) {
							handler.revert(subAction, target);
						}
					}
				}
			});
		}

		this.stack = this.stack.slice(0, this.currentIndex + 1);
		this.stack.push(compositeAction);
		this.currentIndex++;

		this.activeBatches.delete(batchId);
	}

	public cancelBatch(batchId: string): void {
		this.activeBatches.delete(batchId);
	}

	public registerHandler<T extends BaseAction>(type: string, handler: ActionHandler<T>): void {
		this.handlers.set(type, handler);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public registerTarget(id: string, target: any): void {
		this.targets.set(id, target);
	}

	public removeTarget(id: string): boolean {
		const isTargetInUse =
			this.stack.some((action) => action.targetId === id) ||
			Array.from(this.activeBatches.values()).some((batch) =>
				batch.actions.some((action) => action.targetId === id)
			);

		if (isTargetInUse) {
			throw new Error(
				`Cannot remove target ${id} as it is currently in use in the action history or active batches`
			);
		}

		return this.targets.delete(id);
	}

	public removeHandler(type: string): boolean {
		const isHandlerInUse =
			this.stack.some((action) => action.type === type) ||
			Array.from(this.activeBatches.values()).some((batch) =>
				batch.actions.some((action) => action.type === type)
			);

		if (isHandlerInUse) {
			throw new Error(
				`Cannot remove handler for action type ${type} as it is currently in use in the action history or active batches`
			);
		}

		return this.handlers.delete(type);
	}

	public undo(): void {
		this.beforeUndoSubscribers.forEach((subscriber) => subscriber());
		if (this.currentIndex < 0) {
			return;
		}

		this.isApplying = true;
		const action = this.stack[this.currentIndex];
		const handler = this.handlers.get(action.type);
		const target = this.targets.get(action.targetId);

		if (!handler || !target) {
			throw new Error('Handler or target not found for undo');
		}

		handler.revert(action, target);
		this.currentIndex--;
		this.isApplying = false;

		this.afterUndoSubscribers.forEach((subscriber) => subscriber());
	}

	public redo(): void {
		this.beforeRedoSubscribers.forEach((subscriber) => subscriber());
		if (this.currentIndex >= this.stack.length - 1) {
			return;
		}

		this.isApplying = true;

		this.currentIndex++;
		const action = this.stack[this.currentIndex];
		const handler = this.handlers.get(action.type);
		const target = this.targets.get(action.targetId);

		if (!handler || !target) {
			throw new Error('Handler or target not found for redo');
		}

		handler.apply(action, target);

		this.isApplying = false;
		this.afterRedoSubscribers.forEach((subscriber) => subscriber());
	}

	public serializeHistory(): string {
		return JSON.stringify({
			stack: this.stack,
			currentIndex: this.currentIndex,
			activeBatches: Object.fromEntries(
				Array.from(this.activeBatches.entries()).map(([id, batch]) => [
					id,
					{
						config: batch.config,
						actions: batch.actions
					}
				])
			)
		});
	}

	public deserializeHistory(serialized: string): void {
		const { stack, currentIndex, activeBatches } = JSON.parse(serialized) as {
			stack: Action[];
			currentIndex: number;
			activeBatches: { [key: string]: { config: BatchConfig; actions: Action[] } };
		};
		this.stack = stack;
		this.currentIndex = currentIndex;
		this.activeBatches = new Map(Object.entries(activeBatches));
	}
}
