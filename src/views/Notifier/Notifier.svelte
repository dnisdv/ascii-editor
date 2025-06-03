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

	const bus = useNotificationBus();
	const pendingDismissals: Record<string, ReturnType<typeof setTimeout>> = {};
	const activeToastCodes = new Set<string>();

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

	const handleNotificationCleared = ({ code }: { code: string }) => {
		scheduleDismissal(code);
	};

	const handleNotification = (notification: Notification) => {
		const code = notification.code;

		if (activeToastCodes.has(code)) {
			clearPendingDismissal(code);

			return;
		}
		clearPendingDismissal(code);
		activeToastCodes.add(code);

		if (notification.type === 'requirement') {
			const componentPropsForCustomToast = {
				description: notification.message,
				close: () => {
					toast.dismiss(notification.code);
				},
				action: {
					label: notification.actions![0].label,
					onClick: notification.actions![0].callback
				}
			};

			toast.custom(InvisibleLayerRequirement, {
				id: notification.code,
				onDismiss: () => {
					activeToastCodes.delete(notification.code);
				},

				duration: Infinity,
				position: 'bottom-center',
				classes: { toast: 'flex items-center justify-center w-full' },

				componentProps: componentPropsForCustomToast
			});
		} else {
			// TODO: handle all types of notifications
			return;
		}
	};

	onMount(() => {
		bus.on('notificationCleared', handleNotificationCleared);
		bus.on('notify', handleNotification);
	});

	onDestroy(() => {
		bus.off('notificationCleared', handleNotificationCleared);
		bus.off('notify', handleNotification);

		Object.keys(pendingDismissals).forEach((code) => {
			clearTimeout(pendingDismissals[code]);
		});
		activeToastCodes.clear();
	});
</script>
