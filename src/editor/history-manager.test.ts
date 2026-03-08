import { describe, expect, it, vi } from 'vitest';

import {
	createActionDefinition,
	type ActionHandler,
	type BaseAction,
	HistoryManager
} from '@editor/history-manager';

type Target = { id: string; value: number };

const inc = createActionDefinition<'inc', { delta: number }, void>('inc');

interface IncAction extends BaseAction {
	type: typeof inc.type;
	targetId: string;
	before: { value: number };
	after: { value: number };
}

class IncHandler implements ActionHandler<IncAction, void, { delta: number }> {
	public lastAction: IncAction | undefined;

	execute(
		target: Target,
		_context: unknown,
		payload: { delta: number } | undefined
	): [IncAction, void] {
		const delta = payload?.delta ?? 0;
		const before = target.value;
		target.value += delta;

		const action: IncAction = {
			type: inc.type,
			targetId: target.id,
			before: { value: before },
			after: { value: target.value }
		};
		this.lastAction = action;
		return [action, undefined];
	}

	apply(action: IncAction, target: Target): void {
		target.value = action.after.value;
	}

	revert(action: IncAction, target: Target): void {
		target.value = action.before.value;
	}
}

function getPrivateMap<T>(
	history: HistoryManager,
	key: 'targets' | 'contexts' | 'handlers' | 'stringHandlers'
): Map<string, T> {
	return history[key] as Map<string, T>;
}

function setup(history = new HistoryManager(), targetId = 't1') {
	const target: Target = { id: targetId, value: 0 };
	const handler = new IncHandler();

	history.registerHandler(inc, handler);
	history.registerTarget(targetId, target);
	history.registerContext(targetId, {});
	return { history, target, handler };
}

describe('HistoryManager', () => {
	it('overwrites an existing target when registering a different instance with the same id', () => {
		const history = new HistoryManager();
		const a = { id: 'same' };
		const b = { id: 'same' };

		history.registerTarget('same', a);
		history.registerTarget('same', b);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const targets: Map<string, unknown> = (history as any).targets;
		expect(targets.get('same')).toBe(b);
	});

	it('allows re-registering the same instance for the same id', () => {
		const history = new HistoryManager();
		const a = { id: 'same' };

		history.registerTarget('same', a);
		history.registerTarget('same', a);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const targets: Map<string, unknown> = (history as any).targets;
		expect(targets.get('same')).toBe(a);
	});

	it('registerContext overwrites the previous context for the same id', () => {
		const history = new HistoryManager();
		history.registerContext('ctx', { a: 1 });
		history.registerContext('ctx', { a: 2 });

		const contexts = getPrivateMap<unknown>(history, 'contexts');
		expect(contexts.get('ctx')).toEqual({ a: 2 });
	});

	it('execute throws when handler/target/context is missing', () => {
		const history = new HistoryManager();
		const def = createActionDefinition<'x', void, void>('x');
		expect(() => history.execute(def, 't')).toThrow(/No handler registered/);

		const handler: ActionHandler<BaseAction, void, void> = {
			execute: () => [{ type: def.type, targetId: 't', before: null, after: null }, undefined],
			apply: () => undefined,
			revert: () => undefined
		};
		history.registerHandler(def, handler);
		history.registerContext('t', {});
		expect(() => history.execute(def, 't')).toThrow(/No target registered/);

		const history2 = new HistoryManager();
		history2.registerHandler(def, handler);
		history2.registerTarget('t', { id: 't' });
		expect(() => history2.execute(def, 't')).toThrow(/No context registered/);
	});

	it('execute deep-copies actions (mutating returned action does not mutate history)', () => {
		const { history, handler } = setup();
		history.execute(inc, 't1', { delta: 5 });

		expect(handler.lastAction).toBeDefined();
		(handler.lastAction as IncAction).after.value = 999;

		const stored = history.getHistory()[0] as IncAction;
		expect(stored.after).toEqual({ value: 5 });
	});

	it('applyAction deep-copies actions (mutating input action does not mutate history)', () => {
		const { history, target } = setup();
		const action: IncAction = {
			type: inc.type,
			targetId: 't1',
			before: { value: 0 },
			after: { value: 2 }
		};

		history.applyAction(action);
		expect(target.value).toBe(2);

		action.after.value = 123;
		const stored = history.getHistory()[0] as IncAction;
		expect(stored.after).toEqual({ value: 2 });
	});

	it('undo/redo are safe at boundaries and correctly apply/revert', () => {
		const { history, target } = setup();

		expect(() => history.undo()).not.toThrow();
		expect(() => history.redo()).not.toThrow();
		expect(target.value).toBe(0);

		history.execute(inc, 't1', { delta: 3 });
		expect(target.value).toBe(3);

		history.undo();
		expect(target.value).toBe(0);

		history.redo();
		expect(target.value).toBe(3);

		expect(() => history.redo()).not.toThrow();
	});

	it('beginBatch prevents duplicate ids; commitBatch with no actions is a no-op', () => {
		const history = new HistoryManager();
		const id = history.beginBatch({ id: 'b1' });
		expect(id).toBe('b1');
		expect(() => history.beginBatch({ id: 'b1' })).toThrow(/already exists/);

		history.commitBatch('b1');
		expect(history.getHistory()).toHaveLength(0);
	});

	it('applyAction with batchId queues actions; commitBatch creates a composite action with proper undo/redo', () => {
		const { history, target } = setup();

		history.beginBatch({ id: 'b', targetId: 't1' });

		const a1: IncAction = {
			type: inc.type,
			targetId: 't1',
			before: { value: 0 },
			after: { value: 1 }
		};
		const a2: IncAction = {
			type: inc.type,
			targetId: 't1',
			before: { value: 1 },
			after: { value: 3 }
		};

		history.applyAction(a1, { batchId: 'b' });
		history.applyAction(a2, { batchId: 'b' });

		expect(target.value).toBe(0);
		expect(history.getHistory()).toHaveLength(0);

		history.commitBatch('b');
		expect(target.value).toBe(3);
		expect(history.getHistory()).toHaveLength(1);
		expect(history.getHistory()[0].type).toBe('COMPOSITE_b');

		history.undo();
		expect(target.value).toBe(0);

		history.redo();
		expect(target.value).toBe(3);
	});

	it('batched config rejects mismatched actions and falls back to normal applyAction', () => {
		const { history, target: t1 } = setup(new HistoryManager(), 't1');
		const t2: Target = { id: 't2', value: 10 };
		history.registerTarget('t2', t2);
		history.registerContext('t2', {});

		history.beginBatch({ id: 'b', targetId: 't1' });
		const actionForT2: IncAction = {
			type: inc.type,
			targetId: 't2',
			before: { value: 10 },
			after: { value: 11 }
		};
		history.applyAction(actionForT2, { batchId: 'b' });

		expect(t1.value).toBe(0);
		expect(t2.value).toBe(11);
		expect(history.getHistory()).toHaveLength(1);
	});

	it('removeTarget throws when targetId is referenced by history; removeHandler throws when action type is referenced by history', () => {
		const { history } = setup();
		history.execute(inc, 't1', { delta: 1 });

		expect(() => history.removeTarget('t1')).toThrow(/currently in use/);
		expect(() => history.removeHandler(inc.type)).toThrow(/currently in use/);

		expect(history.removeTarget('missing')).toBe(false);
		expect(history.removeHandler('missing')).toBe(false);
	});

	it('removeTarget/removeHandler succeed when not referenced in history', () => {
		const { history } = setup();

		expect(history.removeHandler(inc.type)).toBe(true);
		history.registerHandler(inc, new IncHandler());
		expect(history.removeTarget('t1')).toBe(true);
	});

	it('serializeHistory/deserializeHistory preserve stack + index (undo/redo works when target state matches currentIndex)', () => {
		const { history, target } = setup();
		history.execute(inc, 't1', { delta: 5 });
		expect(target.value).toBe(5);

		const serialized = history.serializeHistory();

		const history2 = new HistoryManager();
		const handler2 = new IncHandler();
		const target2: Target = { id: 't1', value: 5 };
		history2.registerHandler(inc, handler2);
		history2.registerTarget('t1', target2);
		history2.registerContext('t1', {});
		history2.deserializeHistory(serialized);

		history2.undo();
		expect(target2.value).toBe(0);
		history2.redo();
		expect(target2.value).toBe(5);
	});

	it('undo/redo subscribers are called and can be unsubscribed', () => {
		const { history } = setup();
		const beforeUndo = vi.fn();
		const afterUndo = vi.fn();
		const beforeRedo = vi.fn();
		const afterRedo = vi.fn();

		const offBU = history.onBeforeUndo(beforeUndo);
		const offAU = history.onAfterUndo(afterUndo);
		const offBR = history.onBeforeRedo(beforeRedo);
		const offAR = history.onAfterRedo(afterRedo);

		history.execute(inc, 't1', { delta: 1 });
		history.undo();
		history.redo();

		expect(beforeUndo).toHaveBeenCalledTimes(1);
		expect(afterUndo).toHaveBeenCalledTimes(1);
		expect(beforeRedo).toHaveBeenCalledTimes(1);
		expect(afterRedo).toHaveBeenCalledTimes(1);

		offBU();
		offAU();
		offBR();
		offAR();
		history.undo();
		history.redo();
		expect(beforeUndo).toHaveBeenCalledTimes(1);
		expect(afterUndo).toHaveBeenCalledTimes(1);
		expect(beforeRedo).toHaveBeenCalledTimes(1);
		expect(afterRedo).toHaveBeenCalledTimes(1);
	});
});
