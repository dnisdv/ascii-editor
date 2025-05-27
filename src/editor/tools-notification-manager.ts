import type { NotificationAction, BaseBusNotification, NotificationType } from "./bus-notification";
import type { CoreApi } from "./core";

export interface NotificationContext {
	timestamp: string;
	toolName: string;
	[key: string]: unknown;
}

export const CORE_NOTIFICATION_CODES = {
	LAYER: {
		NOT_FOUND: 'LAYER_NOT_FOUND',
		HIDDEN: 'LAYER_HIDDEN',
		INVALID: 'LAYER_INVALID',
	},
};

export class ToolNotificationManager {
	private readonly notificationBus: BaseBusNotification;

	constructor(
		private readonly toolName: string,
		private readonly coreApi: CoreApi
	) {
		this.notificationBus = coreApi.getBusManager().notifications;
	}

	private getCurrentTimestamp(): string {
		return new Date().toISOString();
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createContext(context?: Record<string, any>): NotificationContext {
		return {
			timestamp: this.getCurrentTimestamp(),
			toolName: this.toolName,
			...context,
		};
	}

	check(
		condition: boolean,
		code: string,
		message: string,
		type: NotificationType = 'warning',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): boolean {
		if (!condition) {
			this.emit(code, message, type, context, actions);
		}
		return condition;
	}

	checkRequirement(
		condition: boolean,
		code: string,
		message: string,
		type: NotificationType = 'requirement',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): boolean {
		if (!condition) {
			this.emit(code, message, type, context, actions);
		} else {
			this.clear(code);
		}
		return condition;
	}

	clearRequirement(code: string): void {
		this.clear(code);
	}

	checkLayerRequirement(layerId?: string): boolean {
		const layer = layerId
			? this.coreApi.getLayersManager().getLayer(layerId)
			: this.coreApi.getLayersManager().getActiveLayer();

		return this.checkRequirement(
			!!layer,
			CORE_NOTIFICATION_CODES.LAYER.NOT_FOUND,
			`Layer ${layerId || 'active'} not found`,
			'warning',
			this.createContext({ layerId })
		);
	}

	checkLayerVisibleRequirement(layerId?: string): boolean {
		const layer = layerId
			? this.coreApi.getLayersManager().getLayer(layerId)
			: this.coreApi.getLayersManager().getActiveLayer();

		if (!layer) {
			return this.checkLayerRequirement(layerId);
		}

		const isVisible = layer.opts?.visible !== false;

		if (isVisible) {
			this.clear(CORE_NOTIFICATION_CODES.LAYER.HIDDEN);
		} else {
			this.emit(
				CORE_NOTIFICATION_CODES.LAYER.HIDDEN,
				`Layer ${layerId || 'active'} is hidden from tool ${this.toolName}`,
				'requirement',
				this.createContext({ layerId, layerOpts: layer.opts }),
				[
					{
						label: 'Show Layer',
						callback: (() =>
							this.coreApi.getLayersManager().updateLayer(layer.id, { opts: { visible: true } })
						).bind(this),
					},
				]
			);
		}

		return isVisible;
	}

	emit(
		code: string,
		message: string,
		type: NotificationType = 'warning',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): void {
		this.notificationBus.emitNotification(
			code,
			message,
			type,
			{
				meta: this.createContext(context),
				actions,
			}
		);
	}

	clear(code: string): void {
		this.notificationBus.clearNotification(code);
	}


	checkAll(checks: Array<{
		condition: boolean;
		code: string;
		message: string;
		type?: NotificationType;
		context?: Record<string, unknown>;
		actions?: NotificationAction[];
	}>): boolean {
		return checks.every(({ condition, code, message, type, context, actions }) =>
			this.check(condition, code, message, type || 'warning', context, actions)
		);
	}

	checkAllRequirements(checks: Array<{
		condition: boolean;
		code: string;
		message: string;
		type?: NotificationType;
		context?: Record<string, unknown>;
		actions?: NotificationAction[];
	}>): boolean {
		return checks.every(({ condition, code, message, type, context, actions }) =>
			this.checkRequirement(condition, code, message, type || 'requirement', context, actions)
		);
	}
}

