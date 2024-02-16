import { deepClone } from './deep-clone';
import { isClassInstance, isObject } from './shared-utils';

/**
 * Deep merge two objects.
 *
 * @param target - The target object to merge into.
 * @param source - The source object to merge from.
 * @param depth - The depth level for recursive merging (default is 0).
 * @returns The merged object.
 */
export function deepMerge(target: any, source: any, depth = 0): any {
	if (!source || typeof source !== 'object') {
		return target;
	}

	if (depth === 0) {
		target = deepClone(target);
	}

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				if (isObject(source[key])) {
					if (!target[key]) {
						Object.assign(target, { [key]: {} });
					}

					if (!isClassInstance(source[key])) {
						deepMerge(target[key], source[key], depth + 1);
					} else {
						target[key] = source[key];
					}
				} else {
					Object.assign(target, { [key]: source[key] });
				}
			}
		}
	}

	return target;
}
