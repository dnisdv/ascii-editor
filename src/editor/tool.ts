import type { ToolEventManager } from './tools-event-manager';
import type { IToolConfig, IToolModel, IToolOptions } from './types/external/tool';
import type { CoreApi } from './core';
import type { FeedbackAction, FeedbackManager, FeedbackType } from './feedback-manager';
import type { ToolEventMap } from './types';
import { EventEmitter } from './event-emitter';

export interface ITool extends IToolModel, EventEmitter<ToolEventMap> {
	requirements: {
		condition: () => boolean;
		code: string;
		message: string;
		type: FeedbackType;
		context?: Record<string, unknown>;
		actions?: FeedbackAction[];
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
	restoreConfig(config: Record<string, unknown>): void;
	onConfigRestored(): void;
	getApi(): unknown;
}

export abstract class BaseTool<Api extends object = object>
	extends EventEmitter<ToolEventMap>
	implements ITool
{
	requirements: ITool['requirements'] = [];

	name: string;
	isVisible: boolean;
	hotkey?: string | null;

	config: IToolOptions;
	feedbackManager: FeedbackManager;
	private lastRequirementStatus: boolean = false;

	private requirementUnsubscribes: Array<() => void> = [];
	protected coreApi: CoreApi;

	eventManager: ToolEventManager;

	constructor({
		name,
		requirements,
		isVisible,
		hotkey,
		config,
		coreApi
	}: IToolConfig & { requirements?: BaseTool['requirements'] }) {
		super();
		this.coreApi = coreApi;
		this.eventManager = this.coreApi.getToolManager().toolEventManager;
		this.name = name;
		this.hotkey = hotkey || null;
		this.isVisible = isVisible;
		this.config = config;
		this.requirements = requirements || [];

		this.feedbackManager = coreApi.getFeedbackManager();
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

	emitToolFeedback(
		code: string,
		message: string,
		type: FeedbackType = 'warning',
		actions?: FeedbackAction[]
	): void {
		this.feedbackManager.report({ code, message, type, actions });
	}

	deactivate(): void {
		this.requirementUnsubscribes.forEach((unsub) => unsub());
		this.requirementUnsubscribes = [];
	}

	checkRequirements(): boolean {
		const allRequirementsPassed = this.requirements.every((req) => {
			return this.feedbackManager.checkRequirement(
				req.condition(),
				{
					code: req.code,
					message: req.message
				},
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
		this.config = config;
		this.emit('config::changed', this.config);
	}

	restoreConfig(config: Record<string, unknown>) {
		this.config = config;
	}

	getApi(): Api {
		return {} as Api;
	}
}
