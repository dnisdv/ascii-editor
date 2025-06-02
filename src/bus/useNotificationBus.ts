import { getContext } from 'svelte';
import { EditorNotificationBus } from '.';
import { EDITOR_NOTIFICATION_BUS_KEY } from './config';

export const useNotificationBus = (): EditorNotificationBus => {
	const bus: EditorNotificationBus = getContext(EDITOR_NOTIFICATION_BUS_KEY);
	return bus;
};
