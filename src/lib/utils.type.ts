export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type RequireAtLeastOne<T, K extends keyof T> = PartialExcept<T, K>;
