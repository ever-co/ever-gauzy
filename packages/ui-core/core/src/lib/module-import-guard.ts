/**
 * This function checks if a given module has already been loaded into the Angular application.
 * If the module has been loaded, it throws an error to prevent double-loading of core modules,
 * which can lead to unexpected behavior or errors.
 *
 * @param parentModule - The parent module to check if it's already loaded.
 * @param moduleName - The name of the module being checked, used for error messaging.
 */
export function throwIfAlreadyLoaded(parentModule: any, moduleName: string): void {
	if (parentModule) {
		throw new Error(`${moduleName} has already been loaded. Import core modules in the AppModule only.`);
	}
}
