import { deepClone } from './deep-clone';
import { isClassInstance, isObject } from './shared-utils';

export function deepMergeObject<T>(target: any, source: any, depth = 0): T {
	if (!source) {
		return Object.assign({}, target);
	}

	if (depth === 0) {
		target = deepClone(target);
	}

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject((source as any)[key])) {
				if (!(target as any)[key]) {
					Object.assign(target as any, { [key]: {} });
				}
				if (!isClassInstance((source as any)[key])) {
					deepMergeObject(
						(target as any)[key],
						(source as any)[key],
						depth + 1
					);
				} else {
					(target as any)[key] = (source as any)[key];
				}
			} else {
				Object.assign(target, { [key]: (source as any)[key] });
			}
		}
	}
	return target;
}
