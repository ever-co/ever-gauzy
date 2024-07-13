/**
 * Dynamically imports a module at the specified path.
 *
 * @param {string} path - The path to the module to import.
 * @returns {Promise<any>} A promise that resolves to the imported module.
 * @throws Will throw an error if the module fails to load.
 */
export async function lazyLoader(path: string): Promise<any> {
	try {
		const module = await import(/*webpackIgnore: true*/ path);
		return module;
	} catch (error) {
		console.error(`Failed to load module at path: ${path}`, error);
		throw error;
	}
}
