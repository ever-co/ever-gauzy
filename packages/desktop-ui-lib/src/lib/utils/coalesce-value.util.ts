export function coalesceValue<T>(
	value: T | null | undefined,
	defaultValue: T,
	handleUndefined?: (defaultValue: T) => T,
	handleNull?: (defaultValue: T) => T
): T {
	if (value === undefined) {
		if (handleUndefined) {
			return handleUndefined(defaultValue);
		}
		return defaultValue;
	}

	if (value === null) {
		if (handleNull) {
			return handleNull(defaultValue);
		}
		return defaultValue;
	}

	return value;
}
