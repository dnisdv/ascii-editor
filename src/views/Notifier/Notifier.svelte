<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { useNotificationBus } from '@/bus/useNotificationBus';
	import InvisibleLayerRequirement from './Invisible-Layer-Requirement.svelte';
	import ErrorNotifier from './Error-Notifier.svelte';
	import InfoNotifier from './Info-Notifier.svelte';
	import SuccessNotifier from './Success-Notifier.svelte';
	import { NOTIFICATION_CODE_TO_DESCRIPTION_MAP } from './notification-descriptions';

	interface NotificationAction {
		label: string;
		callback: () => void;
	}

	type NotificationType = keyof typeof notificationConfig;

	interface Notification {
		code: string;
		message: string;
		type: NotificationType;
		actions?: NotificationAction[];
	}

	interface NotificationPayload {
		code: string;
		message: string;
		type: string;
		actions?: NotificationAction[];
	}

	const NOTIFICATION_DURATION = 2000;

	const notificationConfig = {
		requirement: {
			component: InvisibleLayerRequirement,
			duration: Infinity,
			getProps: (notification: Notification) => ({
				description: notification.message,
				close: () => toast.dismiss(notification.code),
				action: {
					label: notification.actions![0].label,
					onClick: notification.actions![0].callback
				}
			})
		},
		success: {
			component: SuccessNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: Notification) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] || 'no name (unexpected)',
				close: () => toast.dismiss(notification.code)
			})
		},
		info: {
			component: InfoNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: Notification) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] || 'no name (unexpected)',
				close: () => toast.dismiss(notification.code)
			})
		},
		error: {
			component: ErrorNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: Notification) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] || 'no name (unexpected)',
				close: () => toast.dismiss(notification.code)
			})
		}
	};

	function isHandledNotificationType(type: string): type is NotificationType {
		return type in notificationConfig;
	}

	const bus = useNotificationBus();
	const pendingDismissals = new Map<string, ReturnType<typeof setTimeout>>();
	const activeToastCodes = new Set<string>();

	const clearPendingDismissal = (code: string) => {
		if (pendingDismissals.has(code)) {
			clearTimeout(pendingDismissals.get(code));
			pendingDismissals.delete(code);
		}
	};

	const scheduleDismissal = (code: string, delay: number = 150) => {
		clearPendingDismissal(code);
		const timeoutId = setTimeout(() => {
			toast.dismiss(code);
			pendingDismissals.delete(code);
		}, delay);
		pendingDismissals.set(code, timeoutId);
	};

	const handleNotificationCleared = ({ code }: { code: string }) => {
		scheduleDismissal(code);
	};

	const handleNotification = (notification: NotificationPayload) => {
		const { code, type } = notification;

		if (!isHandledNotificationType(type)) {
			console.warn(`No configuration found for notification type: ${type}`);
			return;
		}

		const config = notificationConfig[type];

		if (type === 'requirement') {
			if (activeToastCodes.has(code)) {
				clearPendingDismissal(code);
				return;
			}
			activeToastCodes.add(code);
		}

		clearPendingDismissal(code);
		toast.custom(config.component, {
			id: code,
			duration: config.duration,
			position: 'bottom-center',
			classes: { toast: 'flex items-center justify-center w-full' },
			componentProps: config.getProps(notification as Notification),
			onDismiss: () => {
				activeToastCodes.delete(code);
			}
		});
	};

	onMount(() => {
		bus.on('notificationCleared', handleNotificationCleared);
		bus.on('notify', handleNotification);
	});

	onDestroy(() => {
		for (const code of pendingDismissals.keys()) {
			clearTimeout(pendingDismissals.get(code));
		}
		pendingDismissals.clear();
		activeToastCodes.clear();
	});
</script>
