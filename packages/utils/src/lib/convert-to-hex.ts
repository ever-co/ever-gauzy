// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

/**
 * Converts an object with numeric id values into a hexadecimal string representation.
 *
 * @param value - An object that contains an 'id' property, which should be an object with numeric values.
 * @returns A hexadecimal string representation of the numeric values in the 'id' object.
 * @throws Will throw an error if the input is invalid or if any id value is out of range (0-255).
 */
export default function toHexString(value: { id: Record<string, number> }): string {
	if (!value || typeof value.id !== 'object') {
		throw new Error('Invalid input: expected an object with an id property.');
	}

	const hexTable = Array.from({ length: 256 }, (_, i) => (i <= 15 ? '0' : '') + i.toString(16));

	const id = Object.values(value.id);

	let hexString = '';
	for (const el of id) {
		if (typeof el !== 'number' || el < 0 || el > 255) {
			throw new Error('Invalid id value: must be a number between 0 and 255.');
		}
		hexString += hexTable[el];
	}
	return hexString;
}
