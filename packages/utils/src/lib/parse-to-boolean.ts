/**
 * Converts a given input into a boolean value.
 * If the input is `undefined` or `null`, it returns `false`.
 *
 * @param value - The input to convert to a boolean.
 * @returns A boolean representation of the given input.
 */
export const parseToBoolean = (value: any): boolean => {
	if (value === undefined || value === null) {
		return false; // Return false for undefined or null
	}

	try {
		const parsed = JSON.parse(value); // Attempt to parse as JSON
		if (typeof parsed === 'boolean') {
			return parsed; // Return if it's already a boolean
		}

		// Convert numbers: 0 is false, other numbers are true
		if (typeof parsed === 'number') {
			return parsed !== 0;
		}

		// Convert common truthy/falsy strings
		if (typeof parsed === 'string') {
			const lowerCase = parsed.toLowerCase().trim();
			return lowerCase === 'true' || lowerCase === '1'; // Consider 'true' and '1' as true
		}

		return Boolean(parsed); // Fallback to Boolean conversion
	} catch (error) {
		// Handle JSON parse errors
		return false; // Return false on parsing errors
	}
};
