/**
 * Represents the structure of a file path object used in the application.
 */
export interface FilePath {
    /**
     * The path to the icon file associated with this file path.
     */
    iconPath: string;
}

/**
 * Represents the structure of a project object stored in Electron Store.
 */
export interface StoreProject {
    /**
     * A note associated with the project.
     */
    note: string;
}

/**
 * Defines the structure of the Electron Store schema for type safety and consistency.
 *
 * The `StoreSchema` interface represents the schema used in the Electron Store.
 * Each property in the schema corresponds to a specific key in the store and
 * ensures type safety when accessing or modifying the data.
 *
 * Example:
 * ```
 * const store = new Store<StoreSchema>();
 * store.set('filePath', { iconPath: '/path/to/icon.png' });
 * const filePath = store.get('filePath');
 * console.log(filePath.iconPath); // Outputs: '/path/to/icon.png'
 * ```
 */
export interface StoreSchema {
    /**
     * Represents the file path configuration stored in the Electron Store.
     * Includes the `iconPath` property which specifies the path to an icon.
     */
    filePath: FilePath;

	/**
	 * Represents the project configuration stored in the Electron Store.
	 */
	project: StoreProject;
}
