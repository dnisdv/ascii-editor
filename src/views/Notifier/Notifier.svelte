<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { useNotificationBus } from '@/bus/useNotificationBus';
	import InvisibleLayerRequirement from './Invisible-Layer-Requirement.svelte';

	interface Notification {
		code: string;
		message: string;
		type: string;
		actions?: { label: string; callback: () => void }[];
	}

	type ToastAction = { label: string; onClick: () => void };
	type ToastOptions = {
		id: string;
		description: string;
		action?: ToastAction;
	};

	const bus = useNotificationBus();
	const pendingDismissals: Record<string, ReturnType<typeof setTimeout>> = {};

	const clearPendingDismissal = (code: string) => {
		if (pendingDismissals[code]) {
			clearTimeout(pendingDismissals[code]);
			delete pendingDismissals[code];
		}
	};

	const scheduleDismissal = (code: string, delay: number = 150) => {
		clearPendingDismissal(code);
		pendingDismissals[code] = setTimeout(() => {
			toast.dismiss(code);
			delete pendingDismissals[code];
		}, delay);
	};

	const createToastOptions = (notification: Notification): ToastOptions => ({
		id: notification.code,
		description: notification.message,
		...(notification.actions && notification.actions.length > 0
			? {
					action: {
						label: notification.actions[0].label,
						onClick: notification.actions[0].callback
					}
				}
			: {})
	});

	const handleNotificationCleared = ({ code }: { code: string }) => {
		scheduleDismissal(code);
	};

	const handleNotification = (notification: Notification) => {
		clearPendingDismissal(notification.code);
		const options = createToastOptions(notification);
		if (notification.type === 'requirement') {
			const componentProps: {
				description: string;
				close: () => void;
				action: { label: string; onClick: () => void };
			} = {
				description: options.description,
				close: () => toast.dismiss(notification.code),
				action: {
					label: notification.actions![0].label,
					onClick: notification.actions![0].callback
				}
			};

			if (options.action) componentProps.action = options.action;
			toast.custom(InvisibleLayerRequirement, {
				...options,
				duration: Infinity,
				dismissable: false,
				position: 'bottom-center',
				classes: { toast: 'flex items-center justify-center w-full' },
				componentProps
			});
		}
	};

	onMount(() => {
		bus.on('notificationCleared', handleNotificationCleared);
		bus.on('notify', handleNotification);
	});

	onDestroy(() => {
		bus.off('notificationCleared', handleNotificationCleared);
		bus.off('notify', handleNotification);
	});
</script>
