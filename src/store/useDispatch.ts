import type { Dispatch, Store } from "redux";
import { STORE_KEY } from "./constants";
import { getContext } from "svelte";

export function useDispatch<T = unknown>(): Dispatch<any> {
  const store: Store<T> = getContext(STORE_KEY);
  return store?.dispatch;
}

export const getDispatch = (store: Store): Dispatch<any> => {
  return store.dispatch
};
