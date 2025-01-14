export function isJSON<T>(input: T): boolean {
	try {
		JSON.parse(input as string);
		return true;
	} catch (e) {
		return false;
	}
}
