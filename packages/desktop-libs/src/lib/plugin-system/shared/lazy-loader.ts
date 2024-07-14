/**
 * Dynamically imports a module at the specified path.
 *
 * @param {string} pathModule - The path to the module to import.
 * @returns {Promise<any>} A promise that resolves to the imported module.
 * @throws Will throw an error if the module fails to load.
 */
export async function lazyLoader(pathModule: string): Promise<any> {
	try {
		const module = require(pathModule);
		return module;
	} catch (error) {
		console.error(`Failed to load module at path: ${pathModule}`, error);
		throw error;
	}
}
