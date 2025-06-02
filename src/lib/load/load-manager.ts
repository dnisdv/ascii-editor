import { writable } from 'svelte/store';

const FAKE_LOAD_TIME = 350;
const UPDATE_INTERVAL = 4;
const EASING_FACTOR = 0.15;

type LoaderState = {
	isLoading: boolean;
	progress: number;
	targetProgress: number;
	promisesResolved: boolean;
	activePromises: Set<Promise<unknown>>;
};

const easeOutQuad = (t: number): number => t * (2 - t);

const createInitialState = (): LoaderState => ({
	isLoading: false,
	progress: 0,
	targetProgress: 0,
	promisesResolved: false,
	activePromises: new Set()
});

const createLoadingState = (existingPromises: Set<Promise<unknown>> = new Set()): LoaderState => ({
	isLoading: true,
	progress: 0,
	targetProgress: 0,
	promisesResolved: false,
	activePromises: existingPromises
});

const updateProgress = (state: LoaderState, startTime: number): LoaderState => {
	if (state.promisesResolved) return state;
	const elapsed = Date.now() - startTime;
	const t = Math.min(elapsed / FAKE_LOAD_TIME, 1);
	return { ...state, targetProgress: easeOutQuad(t) * 90 };
};

const finalizeProgress = (state: LoaderState): LoaderState => ({
	...state,
	targetProgress: 100,
	promisesResolved: true,
	activePromises: new Set()
});

const smoothProgress = (state: LoaderState): LoaderState => {
	if (!state.isLoading) return state;

	const newProgress = state.progress + (state.targetProgress - state.progress) * EASING_FACTOR;

	if (newProgress >= 99.9999) {
		return {
			...state,
			isLoading: false,
			progress: 100,
			activePromises: new Set()
		};
	}

	return { ...state, progress: newProgress };
};

const setupFakePromise = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, FAKE_LOAD_TIME));

const createProgressTracker = (
	startTime: number,
	update: (fn: (s: LoaderState) => LoaderState) => void
) => {
	return setInterval(() => {
		update((state) => updateProgress(state, startTime));
	}, UPDATE_INTERVAL);
};

const createAnimationLoop = (update: (fn: (s: LoaderState) => LoaderState) => void) => {
	return setInterval(() => {
		update((state) => smoothProgress(state));
	}, UPDATE_INTERVAL);
};

const createLoaderStore = () => {
	const { subscribe, update } = writable<LoaderState>(createInitialState());
	let animationIntervalId: NodeJS.Timeout;
	let progressIntervalId: NodeJS.Timeout;

	const handlePromises = (
		promises: Set<Promise<unknown>>,
		update: (fn: (s: LoaderState) => LoaderState) => void
	) => {
		Promise.all(Array.from(promises)).finally(() => {
			update((state) => {
				if (state.activePromises.size === promises.size) {
					clearInterval(progressIntervalId);
					return finalizeProgress(state);
				}
				return state;
			});
		});
	};

	const register = (newPromises: Promise<unknown>[] = []) => {
		update((state) => {
			const startTime = Date.now();

			const promisesToAdd = newPromises.length > 0 ? newPromises : [setupFakePromise()];

			const updatedPromises = new Set([
				...(state.isLoading ? Array.from(state.activePromises) : []),
				...promisesToAdd
			]);

			clearInterval(animationIntervalId);
			clearInterval(progressIntervalId);

			progressIntervalId = createProgressTracker(startTime, update);
			animationIntervalId = createAnimationLoop(update);

			handlePromises(updatedPromises, update);

			return {
				...createLoadingState(updatedPromises),
				progress: state.isLoading ? state.progress : 0,
				targetProgress: state.isLoading ? state.targetProgress : 0
			};
		});
	};

	return {
		subscribe,
		register
	};
};

export const loader = createLoaderStore();
