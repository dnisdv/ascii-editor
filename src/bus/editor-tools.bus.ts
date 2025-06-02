import { BaseBusTools } from '@editor/bus-tools';
import type { IToolModel } from '@editor/types/external/tool';
import {
	activateTool,
	deactivateAllTools,
	deactivateTool,
	registerTool,
	updateToolConfig
} from '@store/slices/tools/tool.actions';
import type { AppStore } from '@store/store';
import { getDispatch } from '@store/useDispatch';

export class EditorToolsBus extends BaseBusTools {
	private store;

	constructor(store: AppStore) {
		super();
		this.store = store;

		this.on('tool::register::response', this.handleToolRegister.bind(this));
		this.on('tool::activate::response', this.handleToolActivation.bind(this));
		this.on('tool::deactivate::response', this.handleToolDeactivation.bind(this));
		this.on('tool::deactivate_all::response', this.handleToolsDeactivationAll.bind(this));
		this.on('tool::update_config::response', this.handleToolUpdate.bind(this));
	}

	handleToolUpdate(tool: Pick<IToolModel, 'name' | 'config'>) {
		const dispatch = getDispatch(this.store);
		dispatch(updateToolConfig(tool));
	}

	handleToolRegister(tool: IToolModel) {
		const dispatch = getDispatch(this.store);
		dispatch(registerTool(tool));
	}

	handleToolActivation(tool: Pick<IToolModel, 'name'>) {
		const dispatch = getDispatch(this.store);
		dispatch(activateTool({ name: tool.name }));
	}

	handleToolDeactivation() {
		const dispatch = getDispatch(this.store);
		dispatch(deactivateTool());
	}

	handleToolsDeactivationAll() {
		const dispatch = getDispatch(this.store);
		dispatch(deactivateAllTools());
	}
}
