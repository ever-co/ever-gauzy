import { isClassInstance } from './is-class-instance';
import { isEmpty } from './is-empty';
import { isPlainObject } from './is-plain-object';

/**
 * Deeply clones an input value.
 *
 * @param input - The value to be deeply cloned. Can be a primitive, array, or object.
 * @returns A deep copy of the input value.
 */
export function deepClone<T extends string | number | any[] | Object>(input: T): T {
	// Return the input itself if it's not an object or is empty
	if (!isPlainObject(input) || isEmpty(input)) {
		return input;
	}

	// Initialize output variable
	let output: any;

	// Clone array types recursively
	if (Array.isArray(input)) {
		output = input.map((item) => deepClone(item));
		return output as T;
	}

	// Return class instances directly
	if (isClassInstance(input)) {
		return input;
	}

	// Clone objects recursively
	output = {} as Record<string, any>;
	for (const key in input) {
		// Prevent prototype pollution (CWE-1321) via `__proto__`. Unlike deepMerge, `constructor` and
		// `prototype` are intentionally NOT skipped here: cloning must preserve ordinary own data keys
		// with those names, and the dangerous recursion only exists in deepMerge's source-driven merge.
		if (key === '__proto__') {
			continue;
		}
		if (Object.prototype.hasOwnProperty.call(input, key)) {
			output[key] = deepClone(input[key]);
		}
	}
	return output as T;
}
