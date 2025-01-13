export interface IDirectoryPathGenerator {
	/**
	 * Generates a base directory path by appending the current date (in `YYYY/MM/DD` format)
	 * to the provided base directory name.
	 *
	 * @param baseDirname - The base directory name to which the date-based subdirectory will be appended.
	 */
	getBaseDirectory(baseDirname: string): string;

	/**
	 * Generates the subdirectory path.
	 *
	 * @returns The subdirectory path as a string in `YYYY/MM/DD` format.
	 */
	getSubDirectory(): string;
}
