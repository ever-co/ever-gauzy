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

/**
 * Represents a constructor function or class type.
 * @template T - Type to be instantiated.
 */
export interface Type<T = any> extends Function {
	/**
	 * Constructor signature.
	 * Creates a new instance of type T with the provided arguments.
	 * @param {...any[]} args - Arguments to be passed to the constructor.
	 * @returns {T} - An instance of type T.
	 */
	new (...args: any[]): T;
}
