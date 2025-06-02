import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from './store';

type ThunkConfig = { state: RootState };

export const createDocumentScopedThunk = <ReturnType, Payload, ExtraThunkArg = void>(
	typePrefix: string,
	thunkFn: (
		payload: Payload & { documentId: string },
		config: { getState: () => RootState; extra: ExtraThunkArg }
	) => ReturnType
) => {
	return createAsyncThunk<ReturnType, Payload, ThunkConfig>(
		typePrefix,
		async (payload, { getState, extra }) => {
			const state = getState();

			const documentId =
				typeof payload === 'object' && payload !== null
					? (payload as Payload & { documentId: string }).documentId || state.document.id
					: state.document.id;

			if (!documentId) {
				throw new Error('No active document ID found in state or payload.');
			}

			const finalPayload =
				typeof payload === 'object' && payload !== null
					? { ...payload, documentId }
					: { documentId };

			return await thunkFn(finalPayload as Payload & { documentId: string }, {
				getState,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				extra: extra as any
			});
		}
	);
};
