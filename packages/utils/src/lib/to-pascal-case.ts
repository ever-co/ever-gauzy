/**
 * Convert a string to PascalCase.
 *
 * @param str - The string to convert.
 * @returns The PascalCase version of the string.
 */
export function toPascalCase(str: string): string {
	return str.replace(/(^\w|_\w)/g, (match: string) =>
	  	match.replace(/_/g, "").toUpperCase()
	)
}
