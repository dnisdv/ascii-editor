import { EventEmitter } from './event-emitter';

export type FeedbackType = 'error' | 'success' | 'warning' | 'info' | 'requirement' | string;

export interface FeedbackAction {
	label: string;
	callback: () => void;
}

export interface FeedbackPayload {
	code: string;
	message: string;
	type: FeedbackType;
	actions?: FeedbackAction[];
	meta?: Record<string, unknown>;
}

type FeedbackEvents = {
	report: FeedbackPayload;
	resolved: { code: string };
};

export class FeedbackManager extends EventEmitter<FeedbackEvents> {
	public report(payload: FeedbackPayload): void {
		this.emit('report', payload);
	}

	public clear(code: string): void {
		this.emit('resolved', { code });
	}

	public check(
		condition: boolean,
		payload: Omit<FeedbackPayload, 'actions'>,
		actions?: FeedbackAction[]
	): boolean {
		if (!condition) {
			this.report({ ...payload, actions });
		}
		return condition;
	}

	public checkRequirement(
		condition: boolean,
		payload: Omit<FeedbackPayload, 'type' | 'actions'>,
		actions?: FeedbackAction[]
	): boolean {
		if (!condition) {
			this.report({ ...payload, type: 'requirement', actions });
		} else {
			this.clear(payload.code);
		}
		return condition;
	}
}
