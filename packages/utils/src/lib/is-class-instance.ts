import { isPlainObject } from './is-plain-object';

/**
 * Check if the item is a class instance (not a plain object).
 *
 * @param item - The item to check.
 * @returns {boolean} - Returns true if the item is a class instance, otherwise false.
 */
export function isClassInstance(item: any): boolean {
	if (!isPlainObject(item)) {
		return false;
	}
	// A null-prototype object (e.g. Object.create(null)) has no `constructor` at
	// all - accessing `.name` on it throws. Treat it as plain data, not a class
	// instance, the same way a normal `{}` literal is.
	if (Object.getPrototypeOf(item) === null) {
		return false;
	}
	// An ordinary object can still carry an own `constructor` that is null or
	// undefined: `{"constructor": null}` is valid JSON, so it arrives with any
	// parsed payload. Reading `.name` on it throws just the same, so treat it as
	// plain data too.
	const constructor = item.constructor;
	if (constructor === null || constructor === undefined) {
		return false;
	}
	return constructor.name !== 'Object';
}
