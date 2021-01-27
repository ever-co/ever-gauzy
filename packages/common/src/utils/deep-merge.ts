import { deepClone } from './deep-clone';
import { isClassInstance, isObjectOrFunction } from './shared-utils';

/**
 * Deep merge.
 * @param target
 * @param source
 * @returns {Object}
 */
export function deepMerge(target: any, source: any, depth = 0) {
	if (!source) {
		return Object.assign({}, target);
	}
	if (depth === 0) {
		target = deepClone(target);
	}

	if (isObjectOrFunction(target) && isObjectOrFunction(source)) {
		for (const key in source) {
			if (isObjectOrFunction(source[key])) {
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
	return target;
}
