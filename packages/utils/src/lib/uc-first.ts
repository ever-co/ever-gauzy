/**
 * Capitalize the first letter of a string.
 *
 * @param str - The input string to capitalize.
 * @param force - If true, convert the rest of the string to lowercase (default is true).
 * @returns The modified string with the first letter capitalized.
 */
export function ucFirst(str: string, force: boolean = true): string {
	str = force ? str.toLowerCase() : str;
	return str.replace(/^([a-zA-Z])/, function (firstLetter: string) {
		return firstLetter.toUpperCase();
	});
}
