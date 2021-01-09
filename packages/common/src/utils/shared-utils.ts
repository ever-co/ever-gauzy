//checks if is object, null val returns false
export function isObject(val: any) {
	if (val === null) {
		return false;
	}
	return typeof val === 'function' || typeof val === 'object';
}

export function isClassInstance(item: any): boolean {
	return isObject(item) && item.constructor.name !== 'Object';
}

export function notEmpty<T>(val: T | undefined | null): val is T {
	return val !== undefined && val !== null;
}
