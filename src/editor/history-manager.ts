// TODO: Improve typing throughout the file

export interface ActionDefinition<T extends string, P, R> {
	readonly type: T;
	_payload?: P;
	_result?: R;
}

export function createActionDefinition<T extends string, P = void, R = void>(
	type: T
): ActionDefinition<T, P, R> {
	return { type };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ActionHandler<T extends BaseAction, R, P = any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	execute(target: any, context: any, payload: P | undefined): [T | undefined, R];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	apply(action: T, target: any, context: any): void;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	revert(action: T, target: any, context: any): void;
}

type HistorySubscriber = () => void;
type HistorySubscriberWithAction = (action: Action) => void;

export class HistoryManager {
	private stack: Action[] = [];
	private currentIndex: number = -1;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private handlers: Map<string, ActionHandler<any, any>> = new Map();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private targets: Map<string, any> = new Map();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private contexts: Map<string, any> = new Map();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private stringHandlers: Map<string, ActionHandler<any, any>> = new Map();

	private isApplying = false;

	private activeBatches: Map<
		string,
		{
			config: BatchConfig;
			actions: Action[];
		}
	> = new Map();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public registerContext(targetId: string, context: any): void {
		this.contexts.set(targetId, context);
	}

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
		this.currentIndex = -1;
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

	public execute<T extends string, P, R>(
		definition: ActionDefinition<T, P, R>,
		targetId: string,
		payload?: P,
		batchId?: string
	): R {
		const handler = this.getHandler(definition.type);
		const target = this.targets.get(targetId);
		const context = this.contexts.get(targetId);

		if (!handler) throw new Error(`No handler registered for action type: ${definition.type}`);
		if (!target) throw new Error(`No target registered with ID: ${targetId}`);
		if (!context) throw new Error(`No context registered with ID: ${targetId}`);

		const [action, result] = handler.execute(target, context, payload);

		if (!action) {
			return result as R;
		}

		const safeAction = JSON.parse(JSON.stringify(action));

		if (batchId) {
			const batch = this.activeBatches.get(batchId);
			if (batch && this.canAddToBatch(batchId, safeAction)) {
				batch.actions.push(safeAction);
				return result as R;
			}
		}

		this.stack = this.stack.slice(0, this.currentIndex + 1);
		this.stack.push(safeAction);
		this.currentIndex++;

		return result;
	}

	public applyAction(action: Action, config?: { batchId?: string; applyAction?: boolean }): void {
		this.beforeApplyActionSubscribers.forEach((subscriber) => subscriber(action));
		if (this.isApplying) return;

		const handler = this.getHandler(action.type);
		const target = this.targets.get(action.targetId);
		const context = this.contexts.get(action.targetId);

		if (!handler) throw new Error(`No handler registered for action type: ${action.type}`);
		if (!target) throw new Error(`No target registered with ID: ${action.targetId}`);
		if (!context) throw new Error(`No context registered with ID: ${action.targetId}`);

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
			handler.apply(action, target, context);
		}

		const safeAction = JSON.parse(JSON.stringify(action));
		this.stack = this.stack.slice(0, this.currentIndex + 1);
		this.stack.push(safeAction);
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
			const context = this.contexts.get(action.targetId);

			if (!handler) throw new Error(`No handler registered for action type: ${action.type}`);
			if (!target) throw new Error(`No target registered with ID: ${action.targetId}`);
			if (!context) throw new Error(`No context registered with ID: ${action.targetId}`);

			handler.apply(action, target, context);
		});

		const compositeAction: BaseAction = {
			type: `COMPOSITE_${batchId}`,
			before: batch.actions.map((a) => a.before),
			after: batch.actions.map((a) => a.after),
			targetId: batch.actions[0].targetId
		};

		if (!this.getHandler(compositeAction.type)) {
			this.registerStringHandler(compositeAction.type, {
				execute: () => {
					throw new Error('Composite actions are created internally and cannot be executed.');
				},

				apply: () => {
					batch.actions.forEach((subAction) => {
						const handler = this.handlers.get(subAction.type);
						const target = this.targets.get(subAction.targetId);
						const context = this.contexts.get(subAction.targetId);
						if (handler && target && context) {
							handler.apply(subAction, target, context);
						}
					});
				},

				revert: () => {
					for (let i = batch.actions.length - 1; i >= 0; i--) {
						const subAction = batch.actions[i];
						const handler = this.handlers.get(subAction.type);
						const target = this.targets.get(subAction.targetId);
						const context = this.contexts.get(subAction.targetId);
						if (handler && target && context) {
							handler.revert(subAction, target, context);
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

	public registerHandler<T extends string, P, R>(
		definition: ActionDefinition<T, P, R>,

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		handler: ActionHandler<any, R, P>
	): void {
		this.handlers.set(definition.type, handler);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private registerStringHandler(type: string, handler: ActionHandler<any, any>): void {
		this.stringHandlers.set(type, handler);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private getHandler(type: string): ActionHandler<any, any> | undefined {
		return this.handlers.get(type) ?? this.stringHandlers.get(type);
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

		return this.handlers.delete(type) || this.stringHandlers.delete(type);
	}

	public undo(): void {
		this.beforeUndoSubscribers.forEach((subscriber) => subscriber());
		if (this.currentIndex < 0) {
			return;
		}

		this.isApplying = true;
		const action = this.stack[this.currentIndex];
		const handler = this.getHandler(action.type);
		const target = this.targets.get(action.targetId);
		const context = this.contexts.get(action.targetId);

		if (!handler) throw new Error(`No handler registered for action type: ${action.type}`);
		if (!target) throw new Error(`No target registered with ID: ${action.targetId}`);
		if (!context) throw new Error(`No context registered with ID: ${action.targetId}`);

		handler.revert(action, target, context);
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
		const handler = this.getHandler(action.type);
		const target = this.targets.get(action.targetId);
		const context = this.contexts.get(action.targetId);

		if (!handler) throw new Error(`No handler registered for action type: ${action.type}`);
		if (!target) throw new Error(`No target registered with ID: ${action.targetId}`);
		if (!context) throw new Error(`No context registered with ID: ${action.targetId}`);

		handler.apply(action, target, context);

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
