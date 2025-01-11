/**
 * Retrieves the version from package.json.
 * @returns {string | undefined} The version if available, otherwise undefined.
 */
export const getVersion = (): string | undefined => {
	try {
		return require('../../package.json').version;
	} catch (error) {
		console.error(`Error retrieving version from package.json:`, error);
		return undefined;
	}
};
