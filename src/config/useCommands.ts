import type { EditorCommands } from '@editor/commands';
import { useCore } from './useCore';

export function useCommands(): EditorCommands {
	const core = useCore();
	return core.getCommands();
}
