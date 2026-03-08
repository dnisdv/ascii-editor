<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { useCore } from '@/config/useCore';
	import InvisibleLayerRequirement from './Invisible-Layer-Requirement.svelte';
	import ErrorNotifier from './Error-Notifier.svelte';
	import InfoNotifier from './Info-Notifier.svelte';
	import SuccessNotifier from './Success-Notifier.svelte';
	import { NOTIFICATION_CODE_TO_DESCRIPTION_MAP } from './notification-descriptions';
	import type { FeedbackPayload } from '@/editor/feedback-manager';

	const core = useCore();
	const feedbackManager = core.getFeedbackManager();

	const NOTIFICATION_DURATION = 2000;

	const notificationConfig = {
		requirement: {
			component: InvisibleLayerRequirement,
			duration: Infinity,
			getProps: (notification: FeedbackPayload) => ({
				description: notification.message,
				close: () => toast.dismiss(notification.code),
				actions: notification.actions?.map((a) => ({
					label: a.label,
					onClick: a.callback
				}))
			})
		},
		success: {
			component: SuccessNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: FeedbackPayload) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] ||
					notification.message ||
					'Success',
				close: () => toast.dismiss(notification.code)
			})
		},
		info: {
			component: InfoNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: FeedbackPayload) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] || notification.message || 'Info',
				close: () => toast.dismiss(notification.code)
			})
		},
		error: {
			component: ErrorNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: FeedbackPayload) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] ||
					notification.message ||
					'Error',
				close: () => toast.dismiss(notification.code)
			})
		},
		warning: {
			component: InfoNotifier,
			duration: NOTIFICATION_DURATION,
			getProps: (notification: FeedbackPayload) => ({
				description:
					NOTIFICATION_CODE_TO_DESCRIPTION_MAP[notification.code] ||
					notification.message ||
					'Warning',
				close: () => toast.dismiss(notification.code)
			})
		}
	};

	function isHandledNotificationType(type: string): type is keyof typeof notificationConfig {
		return type in notificationConfig;
	}

	const pendingDismissals = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	const activeToastCodes = new SvelteSet<string>();

	const clearPendingDismissal = (code: string) => {
		if (pendingDismissals.has(code)) {
			clearTimeout(pendingDismissals.get(code)!);
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

	const handleNotification = (notification: FeedbackPayload) => {
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
			componentProps: config.getProps(notification),
			onDismiss: () => {
				activeToastCodes.delete(code);
			}
		});
	};

	onMount(() => {
		feedbackManager.on('resolved', handleNotificationCleared);
		feedbackManager.on('report', handleNotification);
	});

	onDestroy(() => {
		feedbackManager.off('resolved', handleNotificationCleared);
		feedbackManager.off('report', handleNotification);

		for (const code of pendingDismissals.keys()) {
			clearTimeout(pendingDismissals.get(code));
		}
		pendingDismissals.clear();
		activeToastCodes.clear();
	});
</script>
