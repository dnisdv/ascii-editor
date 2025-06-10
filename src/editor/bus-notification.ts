import { EventEmitter } from './event-emitter';
export type NotificationType =
	| 'error'
	| 'success'
	| 'warning'
	| 'info'
	| 'message'
	| 'requirement'
	| string;

export interface NotificationAction {
	label: string;
	callback: () => void;
}

export interface NotificationPayload {
	code: string;
	message: string;
	type: NotificationType;
	timestamp: number;
	meta?: Record<string, unknown>;
	actions?: NotificationAction[];
}

export interface NotificationEventMap {
	notify: NotificationPayload;
	error: NotificationPayload;
	warning: NotificationPayload;
	info: NotificationPayload;
	message: NotificationPayload;
	notificationCleared: { code: string };
	[key: string]: NotificationPayload | { code: string } | undefined;
}

export class BaseBusNotification extends EventEmitter<NotificationEventMap> {
	constructor() {
		super();
	}

	emitNotification(
		code: string,
		message: string,
		type: NotificationType,
		options?: {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			meta?: Record<string, any>;
			actions?: NotificationAction[];
		}
	): void {
		const payload: NotificationPayload = {
			code,
			message,
			type,
			meta: options?.meta,
			actions: options?.actions,
			timestamp: Date.now()
		};

		this.emit('notify', payload);
		this.emit(type, payload);
	}

	clearNotification(code: string): void {
		this.emit('notificationCleared', { code });
	}
}
