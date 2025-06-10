import type { NotificationAction, BaseBusNotification, NotificationType } from './bus-notification';
import type { CoreApi } from './core';

export interface NotificationContext {
	timestamp: string;
	source: string;
	[key: string]: unknown;
}

export class NotificationManager {
	private readonly notificationBus: BaseBusNotification;

	constructor(private readonly coreApi: CoreApi) {
		this.notificationBus = this.coreApi.getBusManager().notifications;
	}

	private getCurrentTimestamp(): string {
		return new Date().toISOString();
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createContext(source: string, context?: Record<string, any>): NotificationContext {
		return {
			timestamp: this.getCurrentTimestamp(),
			source,
			...context
		};
	}

	public emit(
		source: string,
		code: string,
		message: string,
		type: NotificationType = 'warning',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): void {
		this.notificationBus.emitNotification(code, message, type, {
			meta: this.createContext(source, context),
			actions
		});
	}

	public check(
		source: string,
		condition: boolean,
		code: string,
		message: string,
		type: NotificationType = 'warning',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): boolean {
		if (!condition) {
			this.emit(source, code, message, type, context, actions);
		}
		return condition;
	}

	public checkRequirement(
		source: string,
		condition: boolean,
		code: string,
		message: string,
		type: NotificationType = 'requirement',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): boolean {
		if (!condition) {
			this.emit(source, code, message, type, context, actions);
		} else {
			this.clear(code);
		}
		return condition;
	}

	public clear(code: string): void {
		this.notificationBus.clearNotification(code);
	}
}
