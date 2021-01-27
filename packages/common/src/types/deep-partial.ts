/**
 * A recursive implementation of the Partial<T> type.
 * Source: https://stackoverflow.com/a/49936686/772859
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends Readonly<infer U>[]
		? Readonly<DeepPartial<U>>[]
		: DeepPartial<T[P]>;
};
