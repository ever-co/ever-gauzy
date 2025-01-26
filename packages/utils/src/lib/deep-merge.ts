import { deepClone } from './deep-clone';
import { isClassInstance } from './is-class-instance';
import { isPlainObject } from './is-plain-object';

/**
 * Deeply merges two objects.
 *
 * @param target - The target object to merge into.
 * @param source - The source object to merge from.
 * @param depth - The depth level for recursive merging (default is 0).
 * @returns The merged object.
 */
export function deepMerge(target: any, source: any, depth = 0): any {
	// Return the target if source is not an object
	if (!source || typeof source !== 'object') {
		return target;
	}

	// Clone target at depth 0 to avoid mutating original target
	if (depth === 0) {
		target = deepClone(target);
	}

	// Merge objects recursively
	if (isPlainObject(target) && isPlainObject(source)) {
		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				// If the source value is an object, recursively merge
				if (isPlainObject(source[key])) {
					if (!target[key]) {
						target[key] = {};
					}

					if (!isClassInstance(source[key])) {
						deepMerge(target[key], source[key], depth + 1);
					} else {
						// If the source is a class instance, do not merge, just assign
						target[key] = source[key];
					}
				} else {
					// Directly assign the value from source to target
					target[key] = source[key];
				}
			}
		}
	}

	return target;
}
