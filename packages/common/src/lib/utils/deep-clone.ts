import { isClassInstance, isEmpty, isObject } from './shared-utils';

export function deepClone<T extends string | number | any[] | Object>(
	input: T
): T {
	// if not array or object or is null return self
	if (!isObject(input) || isEmpty(input)) {
		return input;
	}

	let output: any;
	let i: number | string;

	// handle case: array
	if (input instanceof Array) {
		let l: number | string;
		output = [] as any[];
		for (i = 0, l = input.length; i < l; i++) {
			output[i] = deepClone(input[i]);
		}
		return output;
	}

	// handle case: class
	if (isClassInstance(input)) {
		return input;
	}

	// handle case: object
	output = {};
	if (input instanceof Object) {
		for (i in input) {
			if (input.hasOwnProperty(i)) {
				output[i] = deepClone((input as any)[i]);
			}
		}
		return output;
	}
}
