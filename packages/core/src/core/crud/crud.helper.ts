/**
 * Generic type representing a constructor function.
 *
 * @template T - Type to be instantiated.
 */
export type ConstructorType<T = {}> = new (...args: any[]) => T;
