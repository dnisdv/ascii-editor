import type { BusManager } from './bus-manager';
import type { NotificationAction, NotificationType } from './bus-notification';
import { NotificationManager } from './notification-manager';
import type { ToolEventManager } from './tools-event-manager';
import type { IToolConfig, IToolModel, IToolOptions } from './types/external/tool';
import type { CoreApi } from './core';

export interface ITool extends IToolModel {
	requirements: {
		condition: () => boolean;
		code: string;
		message: string;
		type: NotificationType;
		context?: Record<string, unknown>;
		actions?: NotificationAction[];
		subscribe?: (callback: () => void) => void;
	}[];

	readonly name: string;
	readonly isVisible: boolean;

	hotkey?: string | null;
	config: IToolOptions;

	activate(): void;
	deactivate(): void;
	cleanup(): void;
	update(): void;
	saveConfig(config: Record<string, unknown>): void;
	onConfigRestored(): void;
	getApi(): unknown;
}

// TODO: SCHEMA FOR CONFIG
export abstract class BaseTool<Api extends object = object> implements ITool {
	requirements: ITool['requirements'] = [];

	name: string;
	isVisible: boolean;
	hotkey?: string | null;

	config: IToolOptions;
	bus: BusManager;
	notificationManager: NotificationManager;
	private lastRequirementStatus: boolean = false;

	private requirementUnsubscribes: Array<() => void> = [];
	protected coreApi: CoreApi;

	eventManager: ToolEventManager;

	constructor({
		name,
		bus,
		requirements,
		isVisible,
		hotkey,
		config,
		coreApi
	}: IToolConfig & { requirements?: BaseTool['requirements'] }) {
		this.coreApi = coreApi;
		this.eventManager = this.coreApi.getToolManager().toolEventManager;
		this.bus = bus;
		this.name = name;
		this.hotkey = hotkey || null;
		this.isVisible = isVisible;
		this.config = config;
		this.requirements = requirements || [];

		this.notificationManager = new NotificationManager(coreApi);
		this.eventManager.registerTool(this);
	}

	getEventApi() {
		return this.eventManager.toolApi(this);
	}

	activate(): void {
		this.checkRequirements();
		this.requirements.forEach((req) => {
			if (req.subscribe) {
				const unsub = req.subscribe(() => this.checkRequirements());
				if (typeof unsub === 'function') {
					this.requirementUnsubscribes.push(unsub);
				}
			}
		});
	}

	emitToolNotification(
		code: string,
		message: string,
		type: NotificationType = 'warning',
		context?: Record<string, unknown>,
		actions?: NotificationAction[]
	): void {
		this.notificationManager.emit(this.name, code, message, type, context, actions);
	}

	deactivate(): void {
		this.requirementUnsubscribes.forEach((unsub) => unsub());
		this.requirementUnsubscribes = [];
	}

	checkRequirements(): boolean {
		const allRequirementsPassed = this.requirements.every((req) => {
			return this.notificationManager.checkRequirement(
				this.name,
				req.condition(),
				req.code,
				req.message,
				'requirement',
				undefined,
				req.actions
			);
		});

		if (allRequirementsPassed !== this.lastRequirementStatus) {
			this.lastRequirementStatus = allRequirementsPassed;
			if (allRequirementsPassed) {
				this.onRequirementSuccess();
			} else {
				this.onRequirementFailure();
			}
		}
		return allRequirementsPassed;
	}

	onRequirementFailure(): void {}
	onRequirementSuccess(): void {}
	cleanup() {}
	update() {}
	onConfigRestored() {}

	saveConfig(config: Record<string, unknown>) {
		this.bus.tools.emit('tool::update_config::request', {
			name: this.name,
			config: { ...this.config, ...config }
		});
	}

	getApi(): Api {
		return {} as Api;
	}
}
